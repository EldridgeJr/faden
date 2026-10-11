import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkPages, type PageText } from "./chunk";
import { embedTexts } from "./embed";
import { extractPdfPages, hasTooLittleText } from "./pdf";

type AdminClient = ReturnType<typeof createAdminClient>;
type SourceToProcess = { id: string; type: string; storage_path: string | null };

// An error whose message the user may see (German). Every other error gets a
// generic message. Its details only go to the server log.
class IngestError extends Error {}

// Supabase sends inserts as one JSON request. 100 rows with 1536 numbers
// each are about 2 MB, a safe size.
const INSERT_BATCH_SIZE = 100;

// Turns an uploaded source into chunks with embeddings.
// Runs in the background (after()) with the admin client. The caller has
// already checked that the source belongs to the logged-in user.
export async function processSource(sourceId: string): Promise<void> {
  const supabase = createAdminClient();

  // Claim the source: pending → processing in one statement. If the action
  // runs twice (double click), only one call gets the row back.
  const { data: source, error: claimError } = await supabase
    .from("sources")
    .update({ status: "processing", error: null })
    .eq("id", sourceId)
    .eq("status", "pending")
    .select("id, notebook_id, type, storage_path")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!source) return;

  try {
    const pages = await loadPages(supabase, source);
    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      throw new IngestError("In dieser Quelle wurde kein Text gefunden.");
    }

    const { embeddings, tokens } = await embedTexts(chunks.map((c) => c.content));

    const rows = chunks.map((chunk, i) => ({
      source_id: source.id,
      notebook_id: source.notebook_id,
      content: chunk.content,
      page: chunk.page,
      position: chunk.position,
      token_count: chunk.tokenCount,
      // pgvector reads the text form "[0.1,0.2,…]".
      embedding: JSON.stringify(embeddings[i]),
    }));
    for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
      const { error } = await supabase
        .from("chunks")
        .insert(rows.slice(start, start + INSERT_BATCH_SIZE));
      if (error) throw error;
    }

    const { error: readyError } = await supabase
      .from("sources")
      .update({
        status: "ready",
        meta: { pages: pages.length, chunks: chunks.length, embeddingTokens: tokens },
      })
      .eq("id", source.id);
    if (readyError) throw readyError;
  } catch (error) {
    // Expected errors (scan, broken PDF) need one line in the log. Only
    // unexpected errors need the full stack trace for debugging.
    if (error instanceof IngestError) {
      console.warn("processSource rejected", source.id, error.message);
    } else {
      console.error("processSource failed", source.id, error);
    }
    // A source has either all its chunks or none. So remove the chunks that
    // were saved before the error.
    await supabase.from("chunks").delete().eq("source_id", source.id);
    await supabase
      .from("sources")
      .update({
        status: "error",
        error:
          error instanceof IngestError
            ? error.message
            : "Die Verarbeitung ist fehlgeschlagen. Bitte versuche es erneut.",
      })
      .eq("id", source.id);
  }
}

async function loadPages(
  supabase: AdminClient,
  source: SourceToProcess,
): Promise<PageText[]> {
  if (source.type !== "pdf" || !source.storage_path) {
    throw new IngestError("Dieser Quellentyp wird noch nicht unterstützt.");
  }

  const { data: file, error } = await supabase.storage
    .from("sources")
    .download(source.storage_path);
  if (error || !file) {
    throw new IngestError("Die Datei wurde nicht gefunden. Bitte lade sie erneut hoch.");
  }

  let pages: PageText[];
  try {
    pages = await extractPdfPages(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new IngestError(
      "Die PDF konnte nicht gelesen werden. Vielleicht ist sie beschädigt oder mit einem Passwort geschützt.",
    );
  }

  if (hasTooLittleText(pages)) {
    throw new IngestError(
      "Diese PDF enthält keinen lesbaren Text. Vermutlich ist sie gescannt. Texterkennung (OCR) unterstützt Faden noch nicht.",
    );
  }
  return pages;
}
