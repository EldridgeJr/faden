"use client";

import type { Citation, Segment } from "@/lib/chat/citations";
import { cn } from "@/lib/utils";

// How citations look everywhere: chat answers, flashcards, podcast transcript.

// The number of a citation as a small lime square.
export function CitationNumber({ n, active = false }: { n: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 align-[2px] font-mono text-xs leading-none font-medium",
        // Active: black with lime text in both themes. bg-primary would turn
        // light in dark mode, and lime on light grey is hard to read.
        active
          ? "bg-highlight-foreground text-highlight ring-1 ring-highlight"
          : "bg-highlight text-highlight-foreground",
      )}
    >
      {n}
    </span>
  );
}

// Text with [n] as buttons. Plain text only: React escapes it, so model
// output never becomes HTML. The segments come from splitCitations.
export function CitedText({
  segments,
  activeNumber,
  onOpen,
}: {
  segments: Segment[];
  activeNumber: number | null;
  onOpen: (n: number) => void;
}) {
  return segments.map((segment, i) =>
    segment.type === "text" ? (
      <span key={i}>{segment.text}</span>
    ) : (
      <button
        key={i}
        type="button"
        onClick={() => onOpen(segment.n)}
        aria-label={`Beleg ${segment.n} anzeigen`}
        aria-pressed={activeNumber === segment.n}
        className="mx-0.5 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <CitationNumber n={segment.n} active={activeNumber === segment.n} />
      </button>
    ),
  );
}

// The cited sources as chips: number, title, page.
export function CitationChips({
  citations,
  activeNumber,
  onOpen,
}: {
  citations: Citation[];
  activeNumber: number | null;
  onOpen: (n: number) => void;
}) {
  if (citations.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {citations.map((citation) => (
        <button
          key={citation.n}
          type="button"
          onClick={() => onOpen(citation.n)}
          className={cn(
            "inline-flex min-h-11 max-w-full items-center gap-2 rounded-[14px] border py-1.5 pr-3.5 pl-2 text-left text-[13px] transition-colors",
            activeNumber === citation.n
              ? "border-foreground/30 bg-tile"
              : "border-border bg-surface hover:bg-tile",
          )}
        >
          <CitationNumber n={citation.n} active={activeNumber === citation.n} />
          <span className="min-w-0 break-words">{citation.sourceTitle}</span>
          {citation.page !== null && (
            <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
              S. {citation.page}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// The citations a text really uses, in order of their number.
export function usedCitations(segments: Segment[], citations: Citation[]): Citation[] {
  const used = new Set(segments.flatMap((s) => (s.type === "citation" ? [s.n] : [])));
  return citations.filter((c) => used.has(c.n)).sort((a, b) => a.n - b.n);
}
