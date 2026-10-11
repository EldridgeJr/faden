import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sourceMetaSchema } from "@/lib/schemas";
import { chunkPages, normalizeText, type PageText } from "./chunk";
import { embedTexts } from "./embed";
import { fetchPage, UrlFetchError } from "./fetch-url";
import { extractPdfPages, hasTooLittleText } from "./pdf";
import { extractReadableText, MIN_READABLE_CHARS } from "./readable";

type AdminClient = ReturnType<typeof createAdminClient>;
type SourceToProcess = {
  id: string;
  type: string;
  storage_path: string | null;
  meta: unknown;
};

// What a loader returns: the text per page, plus a better title and extra
// meta data if the loader found some (for example the title of a web page).
type LoadedSource = {
  pages: PageText[];
  title?: string;
  meta?: { url: string; finalUrl: string };
};

// An error whose message the user may see (German). Every other error gets a
// generic message. Its details only go to the server log.
class IngestError extends Error {}

// Supabase sends inserts as one JSON request. 100 rows with 1536 numbers
// each are about 2 MB, a safe size.
const INSERT_BATCH_SIZE = 100;

// Turns a source into chunks with embeddings.
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
    .select("id, notebook_id, type, storage_path, meta")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!source) return;

  try {
    const loaded = await loadSource(supabase, source);
    const chunks = chunkPages(loaded.pages);
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
        ...(loaded.title ? { title: loaded.title.slice(0, 500) } : {}),
        meta: {
          ...loaded.meta,
          // Only PDFs have pages. Text and web pages are one long page.
          ...(source.type === "pdf" ? { pages: loaded.pages.length } : {}),
          chunks: chunks.length,
          embeddingTokens: tokens,
        },
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

// One loader per source type. Every source has a file in storage at the end:
// PDF and text are uploaded by the user, the text of a web page is saved by
// loadUrl. So the citation view (step 5) can always show the original.
async function loadSource(
  supabase: AdminClient,
  source: SourceToProcess,
): Promise<LoadedSource> {
  if (!source.storage_path) {
    throw new IngestError("Die Datei dieser Quelle fehlt.");
  }
  switch (source.type) {
    case "pdf":
      return { pages: await loadPdf(supabase, source.storage_path) };
    case "text":
      return { pages: [{ page: null, text: await loadText(supabase, source.storage_path) }] };
    case "url":
      return loadUrl(supabase, source.storage_path, source.meta);
    default:
      throw new IngestError("Dieser Quellentyp wird nicht unterstützt.");
  }
}

async function download(supabase: AdminClient, path: string): Promise<Blob> {
  const { data: file, error } = await supabase.storage.from("sources").download(path);
  if (error || !file) {
    throw new IngestError("Die Datei wurde nicht gefunden. Bitte lade sie erneut hoch.");
  }
  return file;
}

async function loadPdf(supabase: AdminClient, path: string): Promise<PageText[]> {
  const file = await download(supabase, path);

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

async function loadText(supabase: AdminClient, path: string): Promise<string> {
  // Blob.text() decodes UTF-8. We upload the text as UTF-8 ourselves.
  return (await download(supabase, path)).text();
}

async function loadUrl(
  supabase: AdminClient,
  path: string,
  rawMeta: unknown,
): Promise<LoadedSource> {
  const meta = sourceMetaSchema.safeParse(rawMeta);
  const url = meta.success ? meta.data.url : undefined;
  if (!url) throw new IngestError("Die Adresse dieser Quelle fehlt.");

  let page;
  try {
    page = await fetchPage(url);
  } catch (error) {
    if (error instanceof UrlFetchError) throw new IngestError(error.message);
    throw error;
  }

  const readable = extractReadableText(page.body, page.contentType);
  // Store the cleaned text: no runs of empty lines from the HTML layout.
  const text = normalizeText(readable.text);
  if (text.length < MIN_READABLE_CHARS) {
    throw new IngestError(
      "Auf dieser Seite wurde kein lesbarer Text gefunden. Vielleicht braucht sie JavaScript oder einen Login.",
    );
  }

  // Save the text we used, so the source shows what Faden really read.
  // The page itself can change or disappear later.
  const { error } = await supabase.storage
    .from("sources")
    .upload(path, new Blob([text], { type: "text/plain" }), {
      contentType: "text/plain",
      upsert: true,
    });
  if (error) throw error;

  return {
    pages: [{ page: null, text }],
    title: readable.title ?? undefined,
    meta: { url, finalUrl: page.finalUrl },
  };
}
