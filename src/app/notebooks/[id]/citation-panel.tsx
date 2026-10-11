"use client";

import { ChevronLeft, ChevronRight, LocateFixed, X } from "lucide-react";
import { useEffect, useRef, useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import type { SourceText } from "@/lib/chat/assemble";
import type { Citation } from "@/lib/chat/citations";

// The citation the user clicked: which answer, which number, and all
// citations of that answer (for "previous" and "next").
export type OpenCitation = {
  messageId: string;
  n: number;
  citations: Citation[];
};

const LOAD_ERROR = "Die Quelle konnte nicht geladen werden.";

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
        <div className="mr-auto flex min-w-0 flex-col">
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

      {/* key: a new citation mounts a fresh view, so the page starts again
          at the page of the citation. */}
      <SourceView key={`${citation.sourceId}:${citation.chunkId}`} citation={citation} />
    </section>
  );
}

type Loaded = { key: string; data?: SourceText; error?: string };

// The text of the source with the cited chunk marked.
function SourceView({ citation }: { citation: Citation }) {
  // PDFs: the page that is shown. Starts at the page of the citation.
  const [page, setPage] = useState(citation.page);
  const key = `${citation.sourceId}:${page ?? "all"}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Still loading while the result belongs to another page.
  const loading = loaded?.key !== key;

  useEffect(() => {
    // AbortController: if the user moves on before the answer comes, the old
    // request is cancelled and cannot overwrite the new result.
    const controller = new AbortController();
    const query = page === null ? "" : `?page=${page}`;
    fetch(`/api/sources/${citation.sourceId}/text${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) {
          const message =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : LOAD_ERROR;
          setLoaded({ key, error: message });
          return;
        }
        // Our own route, typed on both sides (SourceText). No outside input.
        setLoaded({ key, data: body as SourceText });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key, error: LOAD_ERROR });
      });
    return () => controller.abort();
  }, [citation.sourceId, page, key]);

  // When the text is there, scroll the mark into the middle of the view.
  const markRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (loading) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    markRef.current?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [loading]);

  const data = loading ? undefined : loaded?.data;
  const error = loading ? undefined : loaded?.error;
  const range = data?.ranges.find((r) => r.id === citation.chunkId);
  const pageCount = data?.pageCount ?? null;

  return (
    <>
      {citation.page !== null && pageCount !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Seiten" className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Vorherige Seite"
              disabled={loading || page === null || page <= 1}
              onClick={() => setPage((p) => (p === null ? p : p - 1))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span className="min-w-28 text-center font-mono text-xs text-muted-foreground">
              Seite {page} von {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Nächste Seite"
              disabled={loading || page === null || page >= pageCount}
              onClick={() => setPage((p) => (p === null ? p : p + 1))}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
          {page !== citation.page && (
            <Button variant="ghost" size="sm" onClick={() => setPage(citation.page)}>
              <LocateFixed aria-hidden />
              Zur markierten Stelle
            </Button>
          )}
        </div>
      )}

      <article
        aria-busy={loading}
        className="min-h-0 flex-1 overflow-y-auto rounded-tile bg-surface px-5 py-5 sm:px-7"
      >
        {loading && <TextSkeleton />}

        {error && (
          // The source is gone or not readable. The answer keeps a copy of
          // the chunk (messages.citations), so we can still show the passage.
          <>
            <p className="mb-4 rounded-xl bg-tile px-3 py-2 text-xs text-muted-foreground">
              {error} Gezeigt wird der Abschnitt, wie er in der Antwort gespeichert ist.
            </p>
            <p className="max-w-[68ch] text-[15px] leading-relaxed whitespace-pre-wrap">
              <Mark>{citation.content}</Mark>
            </p>
          </>
        )}

        {data && (
          <>
            <p className="mb-4 font-mono text-xs text-muted-foreground">
              {data.page !== null ? `Seite ${data.page}` : data.type === "url" ? "Webseite" : "Text"}
            </p>
            {/* Plain text, React escapes it. The mark is a range in it. */}
            <p className="max-w-[68ch] text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/85">
              {range ? (
                <>
                  {data.text.slice(0, range.start)}
                  <Mark ref={markRef}>{data.text.slice(range.start, range.end)}</Mark>
                  {data.text.slice(range.end)}
                </>
              ) : (
                data.text
              )}
            </p>
          </>
        )}
      </article>

      <p className="text-xs text-muted-foreground">
        {data && !range
          ? "Die markierte Stelle liegt auf einer anderen Seite."
          : "Markiert ist der Abschnitt, auf den sich die Antwort stützt."}
      </p>
    </>
  );
}

// React 19: ref is a normal prop, no forwardRef needed.
function Mark({ ref, children }: { ref?: Ref<HTMLElement>; children: string }) {
  return (
    <mark
      ref={ref}
      // No horizontal padding: with box-decoration-break every line gets its
      // own padding, and an empty line between paragraphs would show as a
      // small lime bar.
      className="scroll-my-8 rounded-sm bg-highlight/45 text-foreground [box-decoration-break:clone]"
    >
      {children}
    </mark>
  );
}

// Grey lines while the text loads.
function TextSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 motion-safe:animate-pulse">
      {[92, 100, 85, 97, 60, 100, 88, 94, 70].map((width, i) => (
        <span key={i} className="h-3.5 rounded-full bg-border" style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}
