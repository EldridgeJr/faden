import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

// Runs before every matched request (see src/proxy.ts).
// Job: refresh an expired access token and write the new cookies to
//   1. the request, so Server Components see the fresh token, and
//   2. the response, so the browser stores it.
// It does not protect pages. Every page and route checks the user itself.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Cache-Control and friends: a CDN must never cache a response
          // that sets a session cookie, or it could serve it to other users.
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // No code between createServerClient and getClaims().
  // getClaims() checks the JWT signature and refreshes the token if needed.
  // Never use getSession() on the server: it does not verify the token.
  await supabase.auth.getClaims();

  // Return this exact response object, or the new cookies get lost.
  return response;
}
