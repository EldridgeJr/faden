"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export type SourceItem = {
  id: string;
  title: string;
  status: string;
  error: string | null;
  pages?: number;
  chunks?: number;
};

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Wartet", className: "bg-[#f3f4f6] text-[#6b7078]" },
  processing: { label: "In Arbeit", className: "bg-[#fdf0d5] text-[#8a5a00]" },
  ready: { label: "Bereit", className: "bg-[#f3f4f6] text-[#6e9a1c]" },
  error: { label: "Fehler", className: "bg-[#fde4db] text-[#a3361a]" },
};

const POLL_INTERVAL_MS = 2000;

export function SourceList({ sources }: { sources: SourceItem[] }) {
  const router = useRouter();
  const busy = sources.some((s) => s.status === "pending" || s.status === "processing");

  // Polling: while a source is busy, ask the server for the page again every
  // 2 seconds. router.refresh() re-renders the Server Component with fresh
  // data. Stops as soon as nothing is busy.
  // Alternative: Supabase Realtime (push instead of asking), more setup.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [busy, router]);

  if (sources.length === 0) {
    return (
      <p className="text-[#6b7078]">
        Noch keine Quellen. Lade eine PDF hoch, füge Text ein oder eine Webseite.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sources.map((source) => {
        const status = STATUS[source.status] ?? STATUS.pending;
        return (
          <li key={source.id} className="flex flex-col gap-1 rounded-[18px] bg-white px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="truncate font-medium">{source.title}</span>
              <span className={`shrink-0 rounded-full px-3 py-1 text-sm ${status.className}`}>
                {status.label}
              </span>
            </div>
            {source.status === "ready" && source.chunks !== undefined && (
              <span className="font-mono text-sm text-[#6b7078]">
                {source.pages !== undefined &&
                  `${source.pages} ${source.pages === 1 ? "Seite" : "Seiten"} · `}
                {source.chunks} {source.chunks === 1 ? "Abschnitt" : "Abschnitte"}
              </span>
            )}
            {source.status === "error" && source.error && (
              <span className="text-sm text-[#a3361a]">{source.error}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
