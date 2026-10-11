import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// Shared steps of every studio job (flashcards, podcast).

type AdminClient = ReturnType<typeof createAdminClient>;

// An error whose message the user may see (German). Every other error gets a
// generic message, its details only go to the server log.
export class StudioError extends Error {}

// Claims an item: pending → processing in one statement. If the job starts
// twice, only one call gets the row back, the other one stops.
export async function claimStudioItem(supabase: AdminClient, itemId: string, kind: string) {
  const { data, error } = await supabase
    .from("studio_items")
    .update({ status: "processing", error: null })
    .eq("id", itemId)
    .eq("kind", kind)
    .eq("status", "pending")
    .select("id, notebook_id, data")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Marks an item as failed and logs the error.
export async function failStudioItem(supabase: AdminClient, itemId: string, error: unknown) {
  // Expected errors need one line in the log, unexpected ones the stack trace.
  if (error instanceof StudioError) {
    console.warn("studio job rejected", itemId, error.message);
  } else {
    console.error("studio job failed", itemId, error);
  }
  const { error: updateError } = await supabase
    .from("studio_items")
    .update({
      status: "error",
      error:
        error instanceof StudioError
          ? error.message
          : "Die Erstellung ist fehlgeschlagen. Bitte versuche es erneut.",
    })
    .eq("id", itemId);
  if (updateError) console.error("studio job: saving the error failed", itemId, updateError);
}
