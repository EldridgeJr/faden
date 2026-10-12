import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

// Admin client for checks the UI cannot show, for example "the file is gone
// from storage". Only reads, and only in this test process on your machine.
//
// Not src/lib/supabase/admin.ts: it imports "server-only", which throws
// outside of Next.js on purpose.
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  }
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

const admin = createAdminClient();

// The sources of a notebook with their storage path.
export async function sourcesOf(notebookId: string) {
  const { data, error } = await admin
    .from("sources")
    .select("id, status, storage_path")
    .eq("notebook_id", notebookId);
  if (error) throw error;
  return data;
}

// How many chunks with an embedding a source has.
export async function embeddedChunkCount(sourceId: string): Promise<number> {
  const { count, error } = await admin
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .not("embedding", "is", null);
  if (error) throw error;
  return count ?? 0;
}

// The file names in the storage folder of a notebook ("<notebookId>/…").
export async function storageFiles(notebookId: string): Promise<string[]> {
  const { data, error } = await admin.storage.from("sources").list(notebookId);
  if (error) throw error;
  return data.map((file) => `${notebookId}/${file.name}`);
}
