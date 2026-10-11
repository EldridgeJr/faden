"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/lib/chat/citations";

// The citation the user clicked: which answer, which number, and all
// citations of that answer (for "previous" and "next").
export type OpenCitation = {
  messageId: string;
  n: number;
  citations: Citation[];
};

export function CitationPanel({
  open,
  onSelect,
  onClose,
}: {
  open: OpenCitation;
  onSelect: (n: number) => void;
  onClose: () => void;
}) {
  const index = open.citations.findIndex((c) => c.n === open.n);
  const citation = open.citations[index];
  if (!citation) return null;
  const previous = open.citations[index - 1];
  const next = open.citations[index + 1];

  return (
    <section aria-labelledby="citation-heading" className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex flex-col">
          <span className="font-mono text-xs text-muted-foreground">
            Beleg {index + 1} von {open.citations.length}
          </span>
          <h2 id="citation-heading" className="text-xl font-medium tracking-tight break-words">
            {citation.sourceTitle}
          </h2>
        </div>
        <div role="group" aria-label="Zwischen Belegen wechseln" className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Vorheriger Beleg"
            disabled={!previous}
            onClick={() => previous && onSelect(previous.n)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Nächster Beleg"
            disabled={!next}
            onClick={() => next && onSelect(next.n)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          <X aria-hidden />
          Schließen
        </Button>
      </div>

      <article className="min-h-0 flex-1 overflow-y-auto rounded-tile bg-surface p-5">
        <p className="mb-3 flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="inline-flex size-6 items-center justify-center rounded-lg bg-highlight font-medium text-highlight-foreground">
            {citation.n}
          </span>
          {citation.page !== null ? `Seite ${citation.page}` : "Abschnitt"}
        </p>
        {/* Plain text, React escapes it. */}
        <p className="leading-relaxed whitespace-pre-wrap">
          <mark className="rounded bg-highlight/45 px-0.5 text-foreground [box-decoration-break:clone]">
            {citation.content}
          </mark>
        </p>
      </article>
      <p className="text-xs text-muted-foreground">
        Markiert ist der Abschnitt, auf den sich die Antwort stützt.
      </p>
    </section>
  );
}
