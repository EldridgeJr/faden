import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Supabase client with the secret key. It bypasses RLS.
// Only for background work (processing sources), and only after the normal
// server client has checked that the user owns the data.
// "server-only" makes the build fail if a Client Component imports this file,
// so the secret key can never reach the browser.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
