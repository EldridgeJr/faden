"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DeleteSourceButton } from "./delete-source-button";

export type SourceItem = {
  id: string;
  title: string;
  status: string;
  error: string | null;
  pages?: number;
  chunks?: number;
};

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Wartet", className: "bg-tile text-muted-foreground" },
  processing: { label: "In Arbeit", className: "bg-busy text-busy-foreground" },
  ready: { label: "Bereit", className: "bg-tile text-ready" },
  error: { label: "Fehler", className: "bg-error text-error-foreground" },
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
      <p className="text-muted-foreground">
        Noch keine Quellen. Lade eine PDF hoch, füge Text ein oder eine Webseite.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sources.map((source) => {
        const status = STATUS[source.status] ?? STATUS.pending;
        return (
          <li key={source.id} className="flex flex-col gap-1 rounded-tile bg-card px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <span className="truncate py-1 font-medium">{source.title}</span>
              <div className="flex shrink-0 items-start gap-2">
                <span className={`rounded-full px-3 py-1 text-sm ${status.className}`}>
                  {status.label}
                </span>
                <DeleteSourceButton sourceId={source.id} title={source.title} />
              </div>
            </div>
            {source.status === "ready" && source.chunks !== undefined && (
              <span className="font-mono text-sm text-muted-foreground">
                {source.pages !== undefined &&
                  `${source.pages} ${source.pages === 1 ? "Seite" : "Seiten"} · `}
                {source.chunks} {source.chunks === 1 ? "Abschnitt" : "Abschnitte"}
              </span>
            )}
            {source.status === "error" && source.error && (
              <span className="text-sm text-error-foreground">{source.error}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
