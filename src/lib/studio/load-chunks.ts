import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Citation } from "@/lib/chat/citations";
import type { Database } from "@/lib/supabase/database.types";
import { pickChunks } from "./pick-chunks";

// The Data API returns at most 1000 rows per request (Supabase default) and
// cuts the rest without an error. A notebook with many PDFs has more chunks.
const PAGE_SIZE = 1000;

// Loads the chunks a studio item is written from, numbered [1] to [n].
// Returns them as citations: the same shape the chat stores, so the
// citation view works for studio items without changes.
//
// The background job calls this with the admin client. The caller must have
// checked that the notebook belongs to the user.
export async function loadStudioChunks(
  supabase: SupabaseClient<Database>,
  notebookId: string,
  sourceIds: string[],
): Promise<Citation[]> {
  // Only ready sources of this notebook, in the order of the source list.
  const { data: sources, error: sourcesError } = await supabase
    .from("sources")
    .select("id, title")
    .eq("notebook_id", notebookId)
    .eq("status", "ready")
    .in("id", sourceIds)
    .order("created_at", { ascending: true });
  if (sourcesError) throw sourcesError;
  if (sources.length === 0) return [];
  const orderedIds = sources.map((source) => source.id);

  // 1. Only the ids and positions of all chunks: small rows, page by page.
  // Ordered by id, so the pages do not overlap or skip rows.
  const refs: { id: number; sourceId: string; position: number }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chunks")
      .select("id, source_id, position")
      .eq("notebook_id", notebookId)
      .in("source_id", orderedIds)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    refs.push(...data.map((row) => ({ id: row.id, sourceId: row.source_id, position: row.position })));
    if (data.length < PAGE_SIZE) break;
  }

  // 2. Choose, then load the text only for the chosen chunks.
  const picked = pickChunks(refs, orderedIds);
  if (picked.length === 0) return [];

  const { data: rows, error: rowsError } = await supabase
    .from("chunks")
    .select("id, content, page")
    .in(
      "id",
      picked.map((chunk) => chunk.id),
    );
  if (rowsError) throw rowsError;

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const titleById = new Map(sources.map((source) => [source.id, source.title]));

  // A chunk can be missing if its source was deleted in between. Drop it
  // before numbering, so the numbers stay 1..n without gaps.
  const found = picked.flatMap((chunk) => {
    const row = rowById.get(chunk.id);
    return row ? [{ chunk, row }] : [];
  });

  return found.map(({ chunk, row }, i) => ({
    n: i + 1,
    chunkId: chunk.id,
    sourceId: chunk.sourceId,
    sourceTitle: titleById.get(chunk.sourceId) ?? "",
    // The generated type says number, but the column allows null.
    page: (row.page as number | null) ?? null,
    position: chunk.position,
    content: row.content,
  }));
}
