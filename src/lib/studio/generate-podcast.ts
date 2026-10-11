import "server-only";
import { generateText, Output } from "ai";
import { STUDIO_REASONING, studioModel, textProviderOptions } from "@/lib/ai/models";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimStudioItem, failStudioItem, StudioError } from "./job";
import { loadStudioChunks } from "./load-chunks";
import {
  buildPodcastInstructions,
  cleanScript,
  podcastDataSchema,
  podcastOutputSchema,
  scriptCitations,
  type PodcastData,
} from "./podcast";

// Caps the cost of one script. About 700 words of German are about 1,500
// tokens, plus JSON and reasoning.
const MAX_OUTPUT_TOKENS = 12000;

// Writes a podcast. Runs in the background (after()) with the admin client.
// The action has already checked that the item belongs to the user.
// Step 6c: the script. The audio follows in step 6d.
export async function generatePodcast(itemId: string): Promise<void> {
  const supabase = createAdminClient();

  const item = await claimStudioItem(supabase, itemId, "podcast");
  if (!item) return;

  try {
    const data = podcastDataSchema.parse(item.data);
    const chunks = await loadStudioChunks(supabase, item.notebook_id, data.sourceIds);
    if (chunks.length === 0) {
      throw new StudioError("Keine der ausgewählten Quellen ist bereit.");
    }

    const { output, totalUsage } = await generateText({
      model: studioModel,
      reasoning: STUDIO_REASONING,
      providerOptions: textProviderOptions,
      instructions: buildPodcastInstructions(chunks),
      prompt: "Schreibe das Skript.",
      output: Output.object({ schema: podcastOutputSchema }),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    console.info("podcast script", {
      inputTokens: totalUsage.inputTokens,
      outputTokens: totalUsage.outputTokens,
      reasoningTokens: totalUsage.outputTokenDetails.reasoningTokens,
    });

    const turns = cleanScript(output.turns, chunks.length);
    const used = new Set(scriptCitations(turns, chunks.length));
    // Not one citation: the model did not use the sources. Better an error
    // than a podcast from the model's own knowledge.
    if (turns.length === 0 || used.size === 0) {
      throw new StudioError("Aus diesen Quellen ließ sich kein Skript schreiben.");
    }

    const ready: PodcastData = {
      ...data,
      title: output.title.trim().slice(0, 120) || "Audio-Zusammenfassung",
      summary: output.summary.trim().slice(0, 300),
      turns,
      citations: chunks.filter((chunk) => used.has(chunk.n)),
    };

    const { error } = await supabase
      .from("studio_items")
      .update({ status: "ready", data: ready })
      .eq("id", item.id);
    if (error) throw error;
  } catch (error) {
    await failStudioItem(supabase, item.id, error);
  }
}
