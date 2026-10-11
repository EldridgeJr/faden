"use client";

import { ChevronLeft, ChevronRight, RotateCcw, Repeat2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { splitCitations, type Citation } from "@/lib/chat/citations";
import type { Flashcard } from "@/lib/studio/flashcards";
import { cn } from "@/lib/utils";
import { CitationPanel, type OpenCitation } from "../../citation-panel";
import { CitationChips, CitedText, usedCitations } from "../../cited-text";

const column = "min-h-0 flex-col rounded-card bg-card p-5";

// A deck of flashcards: one card at a time, click turns it over. The back
// has citations like a chat answer. A click opens the citation view next to
// the deck (large screens) or instead of it (small screens).
export function FlashcardsView({ cards, citations }: { cards: Flashcard[]; citations: Citation[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [openCitation, setOpenCitation] = useState<OpenCitation | null>(null);

  const card = cards[index];
  const isLast = index === cards.length - 1;
  const segments = splitCitations(card.back, new Set(citations.map((c) => c.n)));
  const cited = usedCitations(segments, citations);

  // The citation view knows citations by "messageId". Here: one id per card.
  const cardKey = `card-${index}`;
  const activeNumber = openCitation?.messageId === cardKey ? openCitation.n : null;
  const open = (n: number) => setOpenCitation({ messageId: cardKey, n, citations: cited });

  function goTo(next: number) {
    setIndex(next);
    setFlipped(false);
    setOpenCitation(null);
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className={cn(column, "flex-[3_1_480px] overflow-y-auto", openCitation ? "hidden lg:flex" : "flex")}>
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 py-2 sm:py-6">
          <div className="flex flex-col gap-2">
            {/* aria-live: screen readers hear the new number after "Weiter". */}
            <p aria-live="polite" className="font-mono text-xs text-muted-foreground">
              Karte {index + 1} von {cards.length}
            </p>
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-tile">
              <div
                className="h-full rounded-full bg-highlight transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${((index + 1) / cards.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Turning the card: both faces lie in the same grid cell, the
              back is turned by 180°. backface-visibility hides the face that
              points away. inert takes the hidden face out of tab order and
              screen reader.
              key: every card is a new element that starts on the front.
              Without it, the next card would turn back from 180° and show
              its answer for a moment. */}
          <div key={index} className="[perspective:1600px]">
            <div
              className={cn(
                "grid transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none",
                flipped && "[transform:rotateY(180deg)]",
              )}
            >
              <button
                type="button"
                inert={flipped}
                onClick={() => setFlipped(true)}
                className="flex min-h-[300px] flex-col gap-4 rounded-card border border-border bg-surface p-7 text-left [grid-area:1/1] [backface-visibility:hidden] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Frage</span>
                <span className="text-2xl leading-snug font-medium tracking-tight text-balance">{card.front}</span>
                <span className="mt-auto text-sm text-muted-foreground">Klicken zum Umdrehen</span>
              </button>

              <div
                inert={!flipped}
                className="flex min-h-[300px] flex-col gap-4 rounded-card border border-border bg-surface p-7 [grid-area:1/1] [transform:rotateY(180deg)] [backface-visibility:hidden]"
              >
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Antwort</span>
                <p className="text-[17px] leading-[1.7] whitespace-pre-wrap">
                  <CitedText segments={segments} activeNumber={activeNumber} onOpen={open} />
                </p>
                <div className="mt-auto">
                  <CitationChips citations={cited} activeNumber={activeNumber} onOpen={open} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0}>
              <ChevronLeft aria-hidden />
              Zurück
            </Button>
            {/* Small screens: icon only, the row is too narrow for three
                labels. A tap on the card turns it, too. */}
            <Button variant="secondary" onClick={() => setFlipped((value) => !value)}>
              <Repeat2 aria-hidden />
              <span className="max-sm:sr-only">Umdrehen</span>
            </Button>
            {isLast ? (
              <Button variant="outline" onClick={() => goTo(0)}>
                <RotateCcw aria-hidden />
                Von vorn
              </Button>
            ) : (
              <Button onClick={() => goTo(index + 1)}>
                Weiter
                <ChevronRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
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
