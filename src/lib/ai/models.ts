import { openai } from "@ai-sdk/openai";

// The one place where the app chooses its AI models.
//
// We use the OpenAI provider directly. A plain string like
// "openai/text-embedding-3-small" would go through the Vercel AI Gateway,
// which needs its own key. The provider reads OPENAI_API_KEY itself.

// Must match the column chunks.embedding vector(1536). Another model with
// another size needs a new migration and new embeddings for all chunks.
export const embeddingModel = openai.embeddingModel("text-embedding-3-small");
export const EMBEDDING_DIMENSIONS = 1536;
