import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Supabase client for Client Components (runs in the browser).
// Uses only the publishable key. RLS decides what the user may see.
// createBrowserClient returns the same instance on every call (singleton).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
