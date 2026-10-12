import "server-only";
import { generateSpeech, generateText, Output } from "ai";
import { speechModel, STUDIO_REASONING, studioModel, textProviderOptions } from "@/lib/ai/models";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapWithConcurrency } from "./concurrency";
import { claimStudioItem, failStudioItem, StudioError } from "./job";
import { loadStudioChunks } from "./load-chunks";
import { joinMp3, startTimes } from "./mp3";
import {
  buildPodcastInstructions,
  cleanScript,
  podcastDataSchema,
  podcastOutputSchema,
  scriptCitations,
  SPEAKERS,
  spokenText,
  type PodcastData,
  type PodcastProgress,
} from "./podcast";

// Caps the cost of one script. About 700 words of German are about 1,500
// tokens, plus JSON and reasoning.
const MAX_OUTPUT_TOKENS = 12000;

// Speech calls at the same time. The ElevenLabs Starter plan allows 3
// concurrent requests, a fourth would be refused (Free plan: 2).
const CONCURRENT_SPEECH_CALLS = 3;

// One turn takes 2–4 seconds. A call that hangs must not use up the whole
// maxDuration of 300 seconds.
const SPEECH_TIMEOUT_MS = 60_000;

// Makes a podcast: script → speech per turn → one MP3 in storage.
// Runs in the background (after()) with the admin client. The action has
// already checked that the item belongs to the user.
export async function generatePodcast(itemId: string): Promise<void> {
  const startedAt = Date.now();
  const supabase = createAdminClient();

  const item = await claimStudioItem(supabase, itemId, "podcast");
  if (!item) return;

  async function saveData(data: PodcastData) {
    const { error } = await supabase.from("studio_items").update({ data }).eq("id", itemId);
    if (error) throw error;
  }

  // Set when the MP3 is in storage. If a later step fails, the file is
  // removed again, so no file stays behind without a ready item.
  let uploadedPath: string | null = null;

  try {
    const data = podcastDataSchema.parse(item.data);

    // 1. Script.
    await saveData({ ...data, progress: { stage: "script" } });
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

    const scripted: PodcastData = {
      ...data,
      title: output.title.trim().slice(0, 120) || "Audio-Zusammenfassung",
      summary: output.summary.trim().slice(0, 300),
      turns,
      citations: chunks.filter((chunk) => used.has(chunk.n)),
    };
    await saveData({ ...scripted, progress: { stage: "audio", done: 0, total: turns.length } });

    // 2. Speech: one call per turn, each with the voice of its speaker.
    // Progress writes run one after the other (a chain of promises), so an
    // older count can never overwrite a newer one. They are only for the
    // display: a failed write is logged, not fatal.
    const speechStartedAt = Date.now();
    let done = 0;
    let progressWrites = Promise.resolve();
    const saveProgress = (progress: PodcastProgress) => {
      progressWrites = progressWrites
        .then(() => saveData({ ...scripted, progress }))
        .catch((error) => console.warn("podcast progress not saved", itemId, error));
    };

    const parts = await mapWithConcurrency(turns, CONCURRENT_SPEECH_CALLS, async (turn) => {
      const { audio } = await generateSpeech({
        model: speechModel,
        // Without [n], or the voice would read "eckige Klammer eins".
        // Audio tags like [laughs] stay in, the voice acts them out.
        text: spokenText(turn.text),
        voice: SPEAKERS[turn.speaker].voice,
        outputFormat: "mp3",
        abortSignal: AbortSignal.timeout(SPEECH_TIMEOUT_MS),
      });
      done++;
      saveProgress({ stage: "audio", done, total: turns.length });
      return audio.uint8Array;
    });
    await progressWrites;

    // 3. One MP3. The duration of each part gives the start of each turn.
    const { bytes, durations } = joinMp3(parts);
    const starts = startTimes(durations);
    const durationSeconds = durations.reduce((sum, duration) => sum + duration, 0);
    console.info("podcast audio", {
      turns: turns.length,
      seconds: Math.round(durationSeconds),
      bytes: bytes.length,
      speechMs: Date.now() - speechStartedAt,
    });

    // 4. Upload with the admin client: users cannot write into this bucket.
    await saveData({ ...scripted, progress: { stage: "upload" } });
    const path = `${item.notebook_id}/${item.id}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("studio")
      .upload(path, bytes, { contentType: "audio/mpeg" });
    if (uploadError) throw uploadError;
    uploadedPath = path;

    const ready: PodcastData = {
      ...scripted,
      // Milliseconds are enough for jumping to a turn.
      turns: turns.map((turn, i) => ({ ...turn, start: Math.round(starts[i] * 1000) / 1000 })),
      durationSeconds,
      sizeBytes: bytes.length,
      buildSeconds: Math.round((Date.now() - startedAt) / 1000),
    };
    const { error } = await supabase
      .from("studio_items")
      .update({ status: "ready", data: ready, storage_path: path })
      .eq("id", item.id);
    if (error) throw error;
  } catch (error) {
    if (uploadedPath) {
      const { error: removeError } = await supabase.storage.from("studio").remove([uploadedPath]);
      if (removeError) console.error("podcast: removing the MP3 failed", itemId, removeError);
    }
    await failStudioItem(supabase, item.id, error);
  }
}
