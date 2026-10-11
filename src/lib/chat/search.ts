import "server-only";
import { embed } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS, embeddingModel } from "@/lib/ai/models";
import type { Database } from "@/lib/supabase/database.types";

// How many chunks the model gets per question. They become [1] to [8].
export const MATCH_COUNT = 8;

export type FoundChunk = {
  id: number;
  sourceId: string;
  sourceTitle: string;
  content: string;
  // null for pasted text and web pages: they have no pages.
  page: number | null;
  position: number;
  score: number;
};

// Finds the best chunks for a question in the selected sources.
//
// The client must be the server client of the logged-in user, not the admin
// client. match_chunks runs as "security invoker", so RLS decides which
// chunks the user may see.
export async function searchChunks(
  supabase: SupabaseClient<Database>,
  params: { notebookId: string; sourceIds: string[]; question: string },
): Promise<{ chunks: FoundChunk[]; embeddingTokens: number }> {
  // No source selected: nothing to search, no need to pay for an embedding.
  if (params.sourceIds.length === 0) return { chunks: [], embeddingTokens: 0 };

  // The question must be embedded with the same model as the chunks.
  // Otherwise the vectors are not comparable.
  const { embedding, usage } = await embed({
    model: embeddingModel,
    value: params.question,
  });
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected an embedding with ${EMBEDDING_DIMENSIONS} dimensions`);
  }

  const { data, error } = await supabase.rpc("match_chunks", {
    p_notebook_id: params.notebookId,
    p_source_ids: params.sourceIds,
    // pgvector reads a vector from the text "[0.1,0.2,...]", which is JSON.
    p_query_embedding: JSON.stringify(embedding),
    p_query_text: params.question,
    p_match_count: MATCH_COUNT,
  });
  if (error) throw error;

  const chunks = data.map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    sourceTitle: row.source_title,
    content: row.content,
    // The generated type says number, but the column allows null.
    page: (row.page as number | null) ?? null,
    position: row.position,
    score: row.score,
  }));
  return { chunks, embeddingTokens: usage.tokens };
}
