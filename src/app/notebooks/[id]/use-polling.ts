"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_INTERVAL_MS = 2000;

// Polling: while something is busy (a source, a studio item), ask the server
// for the page again every 2 seconds. router.refresh() re-renders the Server
// Component with fresh data. Stops as soon as nothing is busy.
// Alternative: Supabase Realtime (push instead of asking), more setup.
export function usePolling(active: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, router]);
}
