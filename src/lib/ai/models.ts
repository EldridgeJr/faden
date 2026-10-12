import { elevenlabs } from "@ai-sdk/elevenlabs";
import { openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";

// The one place where the app chooses its AI models.
//
// We use the OpenAI provider directly. A plain string like
// "openai/text-embedding-3-small" would go through the Vercel AI Gateway,
// which needs its own key. The provider reads OPENAI_API_KEY itself.

// Must match the column chunks.embedding vector(1536). Another model with
// another size needs a new migration and new embeddings for all chunks.
export const embeddingModel = openai.embeddingModel("text-embedding-3-small");
export const EMBEDDING_DIMENSIONS = 1536;

// The chat model. gpt-6-luna is the cheapest model on the key
// (0.10 $ / 0.50 $ per 1M input / output tokens, October 2026) and made for
// narrow tasks like "answer only from these 8 chunks".
export const chatModel = openai("gpt-6-luna");

// gpt-6-luna is a reasoning model (default "medium"). "low" is enough to
// find the answer in 8 chunks, and the first word comes sooner.
export const CHAT_REASONING = "low";

// Studio items (flashcards, podcast script): the same model, but "medium".
// Here quality counts more than speed, nobody waits for the first word.
export const studioModel = openai("gpt-6-luna");
export const STUDIO_REASONING = "medium";

// For chat and studio.
export const textProviderOptions = {
  openai: {
    // OpenAI does not keep the response for later API calls. We store the
    // answer ourselves, so there is no reason to leave a copy there.
    store: false,
    // We never show the model's reasoning, so do not ask for a summary of it.
    reasoningSummary: null,
  } satisfies OpenAILanguageModelResponsesOptions,
};

// Text to speech for the podcast: ElevenLabs, model v3. The voices per host
// are in src/lib/studio/podcast.ts (SPEAKERS), native German voices.
// v3 understands audio tags like [laughs] in the text. It does not support
// a language code: it detects German by itself.
// The provider reads ELEVENLABS_API_KEY itself.
export const speechModel = elevenlabs.speech("eleven_v3");
