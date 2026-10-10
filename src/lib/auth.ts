import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Reads the logged-in user from the request cookies.
// getClaims() verifies the JWT signature. Never use getSession() on the
// server for this: it trusts the cookie without checking it.
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims.sub ?? null };
}

// For pages and Server Actions that need a login.
// Not logged in: redirect to /login. Otherwise: the client and the user id.
export async function requireUser() {
  const { supabase, userId } = await getUser();
  if (!userId) redirect("/login");
  return { supabase, userId };
}
