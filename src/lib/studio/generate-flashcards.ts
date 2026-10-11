import "server-only";
import { generateText, Output } from "ai";
import { STUDIO_REASONING, studioModel, textProviderOptions } from "@/lib/ai/models";
import { findCitations } from "@/lib/chat/citations";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildFlashcardsInstructions,
  cleanFlashcards,
  flashcardsDataSchema,
  flashcardsOutputSchema,
  type FlashcardsData,
} from "./flashcards";
import { claimStudioItem, failStudioItem, StudioError } from "./job";
import { loadStudioChunks } from "./load-chunks";

// Caps the cost of one deck. Reasoning tokens count as output, too.
const MAX_OUTPUT_TOKENS = 8000;

// Writes a flashcard deck. Runs in the background (after()) with the admin
// client. The action has already checked that the item belongs to the user.
export async function generateFlashcards(itemId: string): Promise<void> {
  const supabase = createAdminClient();

  const item = await claimStudioItem(supabase, itemId, "flashcards");
  if (!item) return;

  try {
    const data = flashcardsDataSchema.parse(item.data);
    const chunks = await loadStudioChunks(supabase, item.notebook_id, data.sourceIds);
    if (chunks.length === 0) {
      throw new StudioError("Keine der ausgewählten Quellen ist bereit.");
    }

    // The schema checks the JSON of the model (Zod). If the model returns
    // something else, generateText throws and the item gets an error.
    const { output, totalUsage } = await generateText({
      model: studioModel,
      reasoning: STUDIO_REASONING,
      providerOptions: textProviderOptions,
      instructions: buildFlashcardsInstructions(chunks),
      prompt: "Erstelle die Karteikarten.",
      output: Output.object({ schema: flashcardsOutputSchema }),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    console.info("flashcards", {
      inputTokens: totalUsage.inputTokens,
      outputTokens: totalUsage.outputTokens,
      reasoningTokens: totalUsage.outputTokenDetails.reasoningTokens,
    });

    const cards = cleanFlashcards(output.cards, chunks.length);
    if (cards.length === 0) {
      throw new StudioError("In den Quellen steht zu wenig für Karteikarten.");
    }

    // Store only the citations the cards really use.
    const used = new Set(cards.flatMap((card) => findCitations(card.back, chunks.length)));
    const ready: FlashcardsData = {
      ...data,
      title: output.title.trim().slice(0, 120) || "Karteikarten",
      cards,
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
