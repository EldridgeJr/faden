"use client";

import { useState } from "react";
import { splitCitations, type Citation } from "@/lib/chat/citations";
import { countWords, SPEAKERS, type Turn } from "@/lib/studio/podcast";
import { cn } from "@/lib/utils";
import { CitationPanel, type OpenCitation } from "../../citation-panel";
import { CitedText, usedCitations } from "../../cited-text";

const column = "min-h-0 flex-col rounded-card bg-card p-5";
const numberFormat = new Intl.NumberFormat("de-DE");

// The podcast page: summary and transcript with citations. A click on a
// citation opens the citation view next to it (large screens) or instead of
// it (small screens). The player follows in step 6e.
export function PodcastView({
  summary,
  turns,
  citations,
}: {
  summary: string;
  turns: Turn[];
  citations: Citation[];
}) {
  const [openCitation, setOpenCitation] = useState<OpenCitation | null>(null);
  const validNumbers = new Set(citations.map((c) => c.n));

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className={cn(column, "flex-[3_1_480px] gap-5 overflow-y-auto", openCitation ? "hidden lg:flex" : "flex")}>
        {summary && <p className="max-w-[66ch] text-[15px] text-muted-foreground">{summary}</p>}

        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-medium tracking-tight">Transkript</h2>
          <p className="font-mono text-xs text-muted-foreground">
            {turns.length} Redebeiträge · {numberFormat.format(countWords(turns))} Wörter
          </p>
        </div>

        <ol className="flex flex-col gap-1">
          {turns.map((turn, i) => {
            const segments = splitCitations(turn.text, validNumbers);
            // The citation view knows citations by "messageId". Here: one id per turn.
            const turnKey = `turn-${i}`;
            const activeNumber = openCitation?.messageId === turnKey ? openCitation.n : null;
            const open = (n: number) =>
              setOpenCitation({ messageId: turnKey, n, citations: usedCitations(segments, citations) });
            const speaker = SPEAKERS[turn.speaker];

            return (
              <li key={i} className="flex gap-3 rounded-tile px-2 py-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    turn.speaker === "lea" ? "bg-foreground text-background" : "border border-border bg-tile",
                  )}
                >
                  {speaker.name[0]}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{speaker.name}</span>
                  <p className="max-w-[66ch] text-[15px] leading-[1.7]">
                    <CitedText segments={segments} activeNumber={activeNumber} onOpen={open} />
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {openCitation && (
        <div className={cn(column, "flex flex-[2_1_420px]")}>
          <CitationPanel
            open={openCitation}
            onSelect={(n) => setOpenCitation({ ...openCitation, n })}
            onClose={() => setOpenCitation(null)}
          />
        </div>
      )}
    </div>
  );
}
