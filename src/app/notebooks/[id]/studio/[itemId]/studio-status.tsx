"use client";

import { StatusChip } from "@/components/status-chip";
import type { StudioItemSummary } from "@/lib/studio/summary";
import { usePolling } from "../../use-polling";

// Shown while an item is still being made, or when it failed.
// Polls while busy, so the page switches to the result by itself.
export function StudioStatus({ item }: { item: StudioItemSummary }) {
  usePolling(item.state === "busy");

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-card bg-card p-8 text-center">
      {item.state === "busy" ? (
        <>
          <StatusChip tone="busy">In Arbeit</StatusChip>
          {/* aria-live: screen readers hear the progress when it changes. */}
          {item.progress && (
            <p aria-live="polite" className="font-mono text-sm">
              {item.progress}
            </p>
          )}
          <p className="max-w-[44ch] text-sm text-muted-foreground">
            Faden liest deine Quellen und erstellt gerade „{item.title}“. Das dauert meist ein bis
            zwei Minuten. Die Seite aktualisiert sich von selbst.
          </p>
        </>
      ) : (
        <>
          <StatusChip tone="error">Fehler</StatusChip>
          <p role="alert" className="max-w-[44ch] text-sm text-error-foreground">
            {item.error ?? "Dieses Element konnte nicht geladen werden."}
          </p>
        </>
      )}
    </div>
  );
}
