"use client";

import { AlignLeft, FileText, Globe, Plus, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeleteSourceButton } from "./delete-source-button";

export type SourceItem = {
  id: string;
  type: string;
  title: string;
  status: string;
  error: string | null;
  pages?: number;
  chunks?: number;
};

const TYPES: Record<string, { label: string; Icon: typeof FileText }> = {
  pdf: { label: "PDF", Icon: FileText },
  url: { label: "Webseite", Icon: Globe },
  text: { label: "Text", Icon: AlignLeft },
};

const POLL_INTERVAL_MS = 2000;

// "PDF · 12 S. · 38 Abschnitte"
function describe(source: SourceItem): string {
  const parts = [TYPES[source.type]?.label ?? "Quelle"];
  if (source.pages !== undefined && source.type === "pdf") parts.push(`${source.pages} S.`);
  if (source.chunks !== undefined) {
    parts.push(`${source.chunks} ${source.chunks === 1 ? "Abschnitt" : "Abschnitte"}`);
  }
  return parts.join(" · ");
}

export function SourcePanel({
  sources,
  excluded,
  onToggle,
  onToggleAll,
  onAdd,
}: {
  sources: SourceItem[];
  excluded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (selectAll: boolean) => void;
  onAdd: () => void;
}) {
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

  const ready = sources.filter((s) => s.status === "ready");
  const selectedCount = ready.filter((s) => !excluded.has(s.id)).length;
  const allSelected = ready.length > 0 && selectedCount === ready.length;

  return (
    <section aria-labelledby="sources-heading" className="flex min-h-0 flex-1 flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 id="sources-heading" className="text-xl font-medium tracking-tight">
            Quellen
          </h2>
          <span className="font-mono text-[13px] text-muted-foreground">{sources.length}</span>
        </div>
        <Button variant="secondary" size="icon" aria-label="Quelle hinzufügen" onClick={onAdd}>
          <Plus aria-hidden />
        </Button>
      </div>

      {ready.length > 0 && (
        <label className="flex min-h-8 cursor-pointer items-center gap-2.5 px-1 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onToggleAll(!allSelected)}
            className="size-[18px] accent-foreground"
          />
          Alle fertigen Quellen nutzen
          <span className="ml-auto font-mono text-xs">
            {selectedCount}/{ready.length}
          </span>
        </label>
      )}

      <ul className="-mx-1 flex min-h-0 flex-col gap-2 overflow-y-auto px-1">
        {sources.map((source) => (
          <SourceRow
            key={source.id}
            source={source}
            checked={source.status === "ready" && !excluded.has(source.id)}
            onToggle={() => onToggle(source.id)}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={onAdd}
        className="mt-auto flex shrink-0 flex-col items-center gap-1.5 rounded-[20px] border-[1.5px] border-dashed border-border p-4 text-center transition-colors hover:bg-surface"
      >
        <Plus className="size-5" aria-hidden />
        <span className="font-medium">
          {sources.length === 0 ? "Erste Quelle hinzufügen" : "Quelle hinzufügen"}
        </span>
        <span className="text-xs text-muted-foreground">PDF, Webseite oder eingefügter Text</span>
      </button>
    </section>
  );
}

function SourceRow({
  source,
  checked,
  onToggle,
}: {
  source: SourceItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const { Icon } = TYPES[source.type] ?? TYPES.text;
  const isReady = source.status === "ready";
  const isBusy = source.status === "pending" || source.status === "processing";
  const isError = source.status === "error";

  return (
    <li
      className={cn(
        "flex items-start gap-1 rounded-tile py-2.5 pr-1.5 pl-3",
        isError ? "bg-error/50" : "bg-surface",
      )}
    >
      {/* The label makes the whole row (icon, title) toggle the checkbox. */}
      <label className={cn("flex min-w-0 flex-1 items-start gap-3", isReady && "cursor-pointer")}>
        <input
          type="checkbox"
          checked={checked}
          disabled={!isReady}
          onChange={onToggle}
          className="mt-[9px] size-[18px] shrink-0 accent-foreground"
        />
        <span
          aria-hidden
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
            isBusy && "bg-busy text-busy-foreground",
            isError && "bg-error text-error-foreground",
            isReady && "bg-card",
          )}
        >
          {isError ? <TriangleAlert className="size-[18px]" /> : <Icon className="size-[18px]" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium break-words">{source.title}</span>
          {isReady && <span className="font-mono text-xs text-muted-foreground">{describe(source)}</span>}
          {isBusy && (
            <span className="flex flex-col gap-1.5 pt-1">
              {/* No real percentage: we do not track progress. The bar only
                  shows that something is happening. */}
              <span aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-border">
                <span className="absolute inset-y-0 w-1/3 animate-[progress_1.4s_ease-in-out_infinite] rounded-full bg-busy-foreground motion-reduce:animate-none" />
              </span>
              <span className="font-mono text-xs text-busy-foreground">
                {source.status === "pending" ? "Wartet …" : "Wird verarbeitet …"}
              </span>
            </span>
          )}
          {isError && (
            <span className="text-xs text-error-foreground">
              {source.error ?? "Die Verarbeitung ist fehlgeschlagen."}
            </span>
          )}
        </span>
      </label>
      <DeleteSourceButton sourceId={source.id} title={source.title} />
    </li>
  );
}
