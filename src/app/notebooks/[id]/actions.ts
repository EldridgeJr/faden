"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { parsePublicUrl, UrlFetchError } from "@/lib/ingest/fetch-url";
import { processSource } from "@/lib/ingest/process";
import {
  pdfUploadSchema,
  sourceIdSchema,
  textSourceSchema,
  urlSourceSchema,
} from "@/lib/schemas";

export type CreatePdfSourceResult =
  | { ok: true; sourceId: string; path: string; token: string }
  | { ok: false; error: string };

// Step 1 of a PDF upload: create the source row and a signed upload URL.
// The file itself never passes through our server. The browser uploads it
// straight to Supabase Storage (Vercel functions accept only about 4.5 MB).
//
// input is "unknown" on purpose: anyone can call a Server Action with any
// data. Only Zod decides what is valid.
export async function createPdfSource(input: unknown): Promise<CreatePdfSourceResult> {
  const { supabase } = await requireUser();

  const parsed = pdfUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { notebookId, fileName } = parsed.data;

  // We choose the id here, so the storage path is known before the insert.
  const sourceId = crypto.randomUUID();
  const path = `${notebookId}/${sourceId}.pdf`;

  // RLS: the insert only works if the notebook belongs to the user.
  // Unknown and foreign notebooks give the same error.
  const { error: insertError } = await supabase.from("sources").insert({
    id: sourceId,
    notebook_id: notebookId,
    type: "pdf",
    title: fileName.replace(/\.pdf$/i, "").slice(0, 500) || fileName,
    storage_path: path,
  });
  if (insertError) {
    console.error("createPdfSource: insert failed", insertError);
    return { ok: false, error: "Die Quelle konnte nicht angelegt werden." };
  }

  // Runs as the user: the storage insert policy checks the notebook folder.
  const { data, error } = await supabase.storage
    .from("sources")
    .createSignedUploadUrl(path);
  if (error) {
    console.error("createPdfSource: signed URL failed", error);
    await supabase.from("sources").delete().eq("id", sourceId);
    return { ok: false, error: "Der Upload konnte nicht vorbereitet werden." };
  }

  return { ok: true, sourceId, path: data.path, token: data.token };
}

// Step 2, after the upload: start the processing.
export async function startProcessing(sourceId: unknown): Promise<void> {
  const { supabase } = await requireUser();

  const parsed = sourceIdSchema.safeParse(sourceId);
  if (!parsed.success) return;

  // RLS: finds only sources in the user's notebooks. This is the rights
  // check. After it, processSource may use the admin client.
  const { data: source } = await supabase
    .from("sources")
    .select("id, status")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!source || source.status !== "pending") return;

  // after(): the action answers at once, the processing continues after the
  // response. It may run up to maxDuration of the page (see page.tsx).
  after(() => processSource(source.id));

  // Re-render the page, so the list shows "In Arbeit" and starts polling.
  refresh();
}

// State of the forms for text and web pages (useActionState).
export type SourceFormState = { error: string | null };

// Pasted text: the text is in the request, so one action does everything.
// It is saved as a .txt file, like every other source has a file.
export async function createTextSource(
  _prevState: SourceFormState,
  formData: FormData,
): Promise<SourceFormState> {
  const { supabase } = await requireUser();

  const parsed = textSourceSchema.safeParse({
    notebookId: formData.get("notebookId"),
    title: formData.get("title"),
    text: formData.get("text"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { notebookId, title, text } = parsed.data;

  const sourceId = crypto.randomUUID();
  const path = `${notebookId}/${sourceId}.txt`;

  // RLS: works only for the user's own notebooks.
  const { error: insertError } = await supabase.from("sources").insert({
    id: sourceId,
    notebook_id: notebookId,
    type: "text",
    title,
    storage_path: path,
  });
  if (insertError) {
    console.error("createTextSource: insert failed", insertError);
    return { error: "Die Quelle konnte nicht angelegt werden." };
  }

  // As the user: the storage insert policy checks the notebook folder.
  const { error: uploadError } = await supabase.storage
    .from("sources")
    .upload(path, new Blob([text], { type: "text/plain" }), {
      contentType: "text/plain",
    });
  if (uploadError) {
    console.error("createTextSource: upload failed", uploadError);
    await supabase.from("sources").delete().eq("id", sourceId);
    return { error: "Der Text konnte nicht gespeichert werden." };
  }

  after(() => processSource(sourceId));
  refresh();
  return { error: null };
}

// Web page: only the address is saved now. Fetching the page can take
// seconds, so it happens in processSource, after the response.
export async function createUrlSource(
  _prevState: SourceFormState,
  formData: FormData,
): Promise<SourceFormState> {
  const { supabase } = await requireUser();

  const parsed = urlSourceSchema.safeParse({
    notebookId: formData.get("notebookId"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { notebookId, url } = parsed.data;

  // Early check for a quick answer (protocol, port, IP address in the URL).
  // The DNS check follows when the page is fetched.
  let hostname: string;
  try {
    hostname = parsePublicUrl(url).hostname;
  } catch (error) {
    if (error instanceof UrlFetchError) return { error: error.message };
    throw error;
  }

  const sourceId = crypto.randomUUID();
  const { error: insertError } = await supabase.from("sources").insert({
    id: sourceId,
    notebook_id: notebookId,
    type: "url",
    // Placeholder. processSource replaces it with the title of the page.
    title: hostname,
    storage_path: `${notebookId}/${sourceId}.txt`,
    meta: { url },
  });
  if (insertError) {
    console.error("createUrlSource: insert failed", insertError);
    return { error: "Die Quelle konnte nicht angelegt werden." };
  }

  after(() => processSource(sourceId));
  refresh();
  return { error: null };
}
