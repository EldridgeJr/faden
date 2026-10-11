"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { allowStudioRequest } from "@/lib/rate-limit";
import { studioItemIdSchema, studioRequestSchema } from "@/lib/schemas";
import { generateFlashcards } from "@/lib/studio/generate-flashcards";
import { studioState } from "@/lib/studio/status";

export type StudioActionResult = { error: string | null };

// Starts a studio item. The work runs in the background (after()), so the
// action answers at once. The item shows "In Arbeit" and the page polls.
//
// input is "unknown" on purpose: anyone can call a Server Action with any
// data. Only Zod decides what is valid.
export async function createStudioItem(input: unknown): Promise<StudioActionResult> {
  // 1. Login.
  const { supabase, userId } = await requireUser();

  // 2. Input.
  const parsed = studioRequestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { notebookId, sourceIds, kind } = parsed.data;

  // 3. Rate limit, before any paid call.
  if (!(await allowStudioRequest(userId))) {
    return { error: "Du hast gerade sehr viel erstellt. Bitte versuche es später noch einmal." };
  }

  // 4. Rights. RLS shows only sources in the user's notebooks, so foreign
  // ids are dropped here. Only ready sources count.
  const { data: sources, error: sourcesError } = await supabase
    .from("sources")
    .select("id")
    .eq("notebook_id", notebookId)
    .eq("status", "ready")
    .in("id", sourceIds);
  if (sourcesError) throw sourcesError;
  if (sources.length === 0) return { error: "Bitte wähle mindestens eine bereite Quelle aus." };

  // RLS: the insert works only for the user's own notebooks. The job reads
  // the sources from data, so they are fixed now, not when the job runs.
  const { data: item, error: insertError } = await supabase
    .from("studio_items")
    .insert({ notebook_id: notebookId, kind, data: { sourceIds: sources.map((s) => s.id) } })
    .select("id")
    .single();
  if (insertError) {
    console.error("createStudioItem: insert failed", insertError);
    return { error: "Das Element konnte nicht angelegt werden." };
  }

  // Runs after the response, up to maxDuration of the page (see page.tsx).
  after(() => generateFlashcards(item.id));

  refresh();
  return { error: null };
}

// Deletes a studio item: its file in storage (podcast) and its row.
export async function deleteStudioItem(itemId: unknown): Promise<StudioActionResult> {
  const { supabase } = await requireUser();

  const parsed = studioItemIdSchema.safeParse(itemId);
  if (!parsed.success) return { error: "Dieses Element wurde nicht gefunden." };

  // RLS: finds only items in the user's notebooks. Unknown and foreign items
  // give the same answer.
  const { data: item } = await supabase
    .from("studio_items")
    .select("id, status, storage_path, created_at")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!item) return { error: "Dieses Element wurde nicht gefunden." };

  // A running job would write its result (or a file) into a deleted item.
  if (studioState(item.status, item.created_at, new Date()) === "busy") {
    return { error: "Das Element wird gerade erstellt. Bitte warte, bis es fertig ist." };
  }

  // File first, then the row: no file stays behind without a row.
  if (item.storage_path) {
    const { error: storageError } = await supabase.storage.from("studio").remove([item.storage_path]);
    if (storageError) {
      console.error("deleteStudioItem: storage failed", storageError);
      return { error: "Die Datei konnte nicht gelöscht werden. Bitte versuche es erneut." };
    }
  }

  const { error: deleteError } = await supabase.from("studio_items").delete().eq("id", item.id);
  if (deleteError) {
    console.error("deleteStudioItem: delete failed", deleteError);
    return { error: "Das Element konnte nicht gelöscht werden. Bitte versuche es erneut." };
  }

  refresh();
  return { error: null };
}
