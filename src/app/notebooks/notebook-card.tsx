import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { StatusChip } from "@/components/status-chip";
import { formatDay } from "@/lib/format";
import type { NotebookSummary } from "@/lib/notebook-overview";
import { cn } from "@/lib/utils";
import { NotebookMenu } from "./notebook-dialogs";

function sourcesLabel(count: number): string {
  return count === 1 ? "1 Quelle" : `${count} Quellen`;
}

// The status chips of a notebook. Only counts above zero are shown.
function StatusChips({ notebook }: { notebook: NotebookSummary }) {
  return (
    <>
      {notebook.ready > 0 && <StatusChip tone="ready">{notebook.ready} bereit</StatusChip>}
      {notebook.busy > 0 && <StatusChip tone="busy">{notebook.busy} in Arbeit</StatusChip>}
      {notebook.failed > 0 && (
        <StatusChip tone="error">{notebook.failed} Fehler</StatusChip>
      )}
    </>
  );
}

// Decoration from the design: a sheet of paper with text lines. The lime
// line stands for a passage that Faden can cite.
function Paper({ highlighted, className }: { highlighted: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute flex flex-col gap-[7px] rounded-[10px] bg-white px-3 py-3.5 shadow-[0_6px_18px_rgba(17,19,21,0.08)]",
        className,
      )}
    >
      <span className="h-[5px] w-[58%] rounded-full bg-[#111315]" />
      <span className="h-1 w-full rounded-full bg-[#e3e5e8]" />
      <span
        className={cn("w-[92%] rounded-full", highlighted ? "h-1.5 bg-highlight" : "h-1 bg-[#e3e5e8]")}
      />
      <span className="h-1 w-[80%] rounded-full bg-[#e3e5e8]" />
      <span className="h-1 w-full rounded-full bg-[#e3e5e8]" />
    </span>
  );
}

// The big card at the top: the notebook with the latest activity.
// The whole card is one link, so it has no other buttons inside.
export function RecentNotebookCard({ notebook, now }: { notebook: NotebookSummary; now: Date }) {
  return (
    <Link
      href={`/notebooks/${notebook.id}`}
      className="group flex min-w-0 flex-[2_1_460px] flex-wrap gap-5 rounded-card bg-card p-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="relative h-[196px] flex-[0_0_200px] overflow-hidden rounded-[22px] bg-[#111315] max-sm:flex-1"
      >
        <span className="absolute top-[30px] left-[52px] h-[140px] w-[108px] -rotate-9 rounded-xl bg-[#2e3137]" />
        <span className="absolute top-[26px] left-[58px] h-[140px] w-[108px] rotate-5 rounded-xl bg-[#42464d]" />
        <Paper highlighted={notebook.ready > 0} className="top-6 left-[46px] h-[148px] w-[116px]" />
        <span className="absolute bottom-3.5 left-4 inline-flex h-[26px] items-center rounded-full bg-highlight px-2.5 font-mono text-xs text-highlight-foreground">
          {sourcesLabel(notebook.sourceCount)}
        </span>
      </span>
      <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 px-1 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">
          Zuletzt aktiv · {formatDay(new Date(notebook.lastActivityAt), now)}
        </span>
        <span className="text-[25px] leading-tight font-semibold tracking-tight break-words">
          {notebook.title}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <StatusChips notebook={notebook} />
        </span>
        <span className="line-clamp-2 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
          {notebook.lastQuestion
            ? `Zuletzt gefragt: „${notebook.lastQuestion}“`
            : notebook.sourceCount === 0
              ? "Noch keine Quellen. Füge eine PDF, eine Webseite oder einen Text hinzu."
              : "Noch keine Frage gestellt."}
        </span>
        <span className="mt-auto inline-flex h-11 items-center gap-2 self-start rounded-full bg-primary px-[18px] font-medium text-primary-foreground transition-colors group-hover:bg-primary/85">
          Weiterarbeiten
          <ArrowRight className="size-[18px]" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

// A card in the grid "Alle Notebooks".
// The title link stretches over the whole card (after:absolute inset-0).
// The menu button sits above it (z-10), so it stays clickable. A button
// inside a link would be invalid HTML.
export function NotebookCard({ notebook, now }: { notebook: NotebookSummary; now: Date }) {
  return (
    <article className="relative flex flex-col gap-3 rounded-[24px] border border-border bg-card p-2.5 pb-3.5 transition-colors hover:bg-surface">
      <span aria-hidden className="relative block h-[132px] overflow-hidden rounded-tile bg-tile">
        <span className="absolute -bottom-[26px] left-1/2 ml-[-40px] h-[118px] w-24 rotate-7 rounded-[10px] bg-border" />
        <Paper highlighted={notebook.ready > 0} className="-bottom-[30px] left-1/2 ml-[-54px] h-[122px] w-[100px] -rotate-4" />
        <span className="relative flex flex-wrap justify-between gap-1.5 p-2.5">
          <StatusChip tone="neutral">{sourcesLabel(notebook.sourceCount)}</StatusChip>
          {notebook.failed > 0 ? (
            <StatusChip tone="error">Fehler</StatusChip>
          ) : notebook.busy > 0 ? (
            <StatusChip tone="busy">In Arbeit</StatusChip>
          ) : null}
        </span>
      </span>
      <div className="flex items-start gap-2 px-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-base leading-snug font-medium break-words">
            <Link
              href={`/notebooks/${notebook.id}`}
              className="after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {notebook.title}
            </Link>
          </h3>
          <p className="font-mono text-xs text-muted-foreground">
            {sourcesLabel(notebook.sourceCount)} · {formatDay(new Date(notebook.lastActivityAt), now)}
          </p>
        </div>
        <NotebookMenu notebookId={notebook.id} title={notebook.title} className="relative z-10" />
      </div>
    </article>
  );
}
