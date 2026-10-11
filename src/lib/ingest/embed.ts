import { embedMany } from "ai";
import { EMBEDDING_DIMENSIONS, embeddingModel } from "@/lib/ai/models";

// embedMany only splits by count (2048 values per call). OpenAI also limits
// the tokens per request (about 300,000). 100 chunks of at most 800 tokens
// are 80,000 tokens, well below the limit.
const BATCH_SIZE = 100;

// Returns one embedding per text, in the same order, plus the tokens used.
export async function embedTexts(
  texts: string[],
): Promise<{ embeddings: number[][]; tokens: number }> {
  const embeddings: number[][] = [];
  let tokens = 0;

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const result = await embedMany({
      model: embeddingModel,
      values: texts.slice(start, start + BATCH_SIZE),
    });
    embeddings.push(...result.embeddings);
    tokens += result.usage.tokens;
  }

  // Postgres would reject a wrong size anyway. This error is clearer.
  if (embeddings.some((e) => e.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error(`Expected embeddings with ${EMBEDDING_DIMENSIONS} dimensions`);
  }
  return { embeddings, tokens };
}
