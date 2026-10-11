"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canDeleteSource } from "@/lib/ingest/status";
import { notebookIdSchema, notebookTitleSchema, renameNotebookSchema } from "@/lib/schemas";
import { studioState } from "@/lib/studio/status";

export type NotebookFormState = { error: string | null };

const NOT_FOUND = "Dieses Notebook wurde nicht gefunden.";

export async function createNotebook(
  _prevState: NotebookFormState,
  formData: FormData,
): Promise<NotebookFormState> {
  // Check the login here too. A Server Action is a public POST endpoint,
  // anyone can call it without opening the page.
  const { supabase } = await requireUser();

  const parsed = notebookTitleSchema.safeParse(formData.get("title"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // No owner_id sent: the column default is auth.uid(), and the insert
  // policy rejects any other value.
  const { data, error } = await supabase
    .from("notebooks")
    .insert({ title: parsed.data })
    .select("id")
    .single();
  if (error) {
    console.error("createNotebook failed", error);
    return { error: "Das Notebook konnte nicht angelegt werden." };
  }

  // A new notebook is empty. Go there directly, so the user can add sources.
  redirect(`/notebooks/${data.id}`);
}

export async function renameNotebook(
  _prevState: NotebookFormState,
  formData: FormData,
): Promise<NotebookFormState> {
  const { supabase } = await requireUser();

  const parsed = renameNotebookSchema.safeParse({
    notebookId: formData.get("notebookId"),
    title: formData.get("title"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // RLS: the update only reaches the user's own notebooks. A foreign id
  // changes 0 rows. select() returns the changed rows, so we can tell.
  const { data, error } = await supabase
    .from("notebooks")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.notebookId)
    .select("id");
  if (error) {
    console.error("renameNotebook failed", error);
    return { error: "Das Notebook konnte nicht umbenannt werden." };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  refresh();
  return { error: null };
}

// Lists every file in the notebook's folder "<notebook_id>/" of a bucket.
// list() returns at most `limit` names per call, so we page through.
async function listNotebookFiles(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  bucket: string,
  notebookId: string,
): Promise<string[]> {
  const pageSize = 100;
  const paths: string[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(notebookId, { limit: pageSize, offset });
    if (error) throw error;
    paths.push(...data.map((file) => `${notebookId}/${file.name}`));
    if (data.length < pageSize) return paths;
  }
}

export async function deleteNotebook(notebookId: unknown): Promise<NotebookFormState> {
  const { supabase } = await requireUser();

  const parsed = notebookIdSchema.safeParse(notebookId);
  if (!parsed.success) return { error: NOT_FOUND };

  // RLS: finds only the user's own notebooks.
  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id, sources(status, created_at), studio_items(status, created_at)")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!notebook) return { error: NOT_FOUND };

  // Same rule as for a single source: a running job could save a file after
  // we emptied the folder. That file would stay behind forever.
  const now = new Date();
  if (notebook.sources.some((source) => !canDeleteSource(source.status, source.created_at, now))) {
    return { error: "Eine Quelle wird gerade verarbeitet. Bitte warte, bis sie fertig ist." };
  }
  // The same for a podcast: its job would upload the MP3 into the emptied folder.
  if (notebook.studio_items.some((item) => studioState(item.status, item.created_at, now) === "busy")) {
    return { error: "Im Studio wird gerade etwas erstellt. Bitte warte, bis es fertig ist." };
  }

  // Files first, then the row. "on delete cascade" removes sources, chunks,
  // messages and studio items in Postgres, but it cannot reach Storage.
  try {
    for (const bucket of ["sources", "studio"]) {
      const paths = await listNotebookFiles(supabase, bucket, notebook.id);
      // remove() takes at most 1000 paths per call.
      for (let start = 0; start < paths.length; start += 1000) {
        const { error } = await supabase.storage.from(bucket).remove(paths.slice(start, start + 1000));
        if (error) throw error;
      }
    }
  } catch (error) {
    console.error("deleteNotebook: storage failed", error);
    return { error: "Die Dateien konnten nicht gelöscht werden. Bitte versuche es erneut." };
  }

  const { error: deleteError } = await supabase.from("notebooks").delete().eq("id", notebook.id);
  if (deleteError) {
    console.error("deleteNotebook: delete failed", deleteError);
    return { error: "Das Notebook konnte nicht gelöscht werden. Bitte versuche es erneut." };
  }

  // Works from the start page and from the notebook page (which is gone now).
  redirect("/notebooks");
}
