import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 "proxy" (formerly "middleware"): runs before each request.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Skip static files and images. They never need the session.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
