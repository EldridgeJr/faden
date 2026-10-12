"use client";

import { Check, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { splitCitations, type Citation } from "@/lib/chat/citations";
import { formatBuildTime, formatDuration, formatMegabytes } from "@/lib/format";
import { countWords, currentTurnIndex, SPEAKERS, stripAudioTags, type Turn } from "@/lib/studio/podcast";
import { cn } from "@/lib/utils";
import { CitationPanel, type OpenCitation } from "../../citation-panel";
import { CitedText, usedCitations } from "../../cited-text";
import { createStudioItem } from "../../studio-actions";
import { PodcastPlayer } from "./podcast-player";
import { useAudioPlayer, type AudioPlayer } from "./use-audio-player";

const numberFormat = new Intl.NumberFormat("de-DE");

export type PodcastPageData = {
  notebookId: string;
  sourceIds: string[];
  title: string;
  summary: string;
  day: string;
  turns: Turn[];
  citations: Citation[];
  // null for podcasts made before the audio step existed.
  audio: { src: string; durationSeconds: number; sizeBytes: number; buildSeconds: number | null } | null;
};

// The podcast page: player and transcript on the left, a new version and
// how the episode was made on the right. A citation replaces the right
// column (large screens) or the whole page (small screens).
export function PodcastView({ data }: { data: PodcastPageData }) {
  const duration = data.audio?.durationSeconds ?? 0;
  const player = useAudioPlayer(duration);
  const [openCitation, setOpenCitation] = useState<OpenCitation | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className={cn("flex-col gap-4 lg:flex lg:min-h-0 lg:flex-[3_1_560px]", openCitation ? "hidden" : "flex")}>
        {data.audio && (
          <>
            {/* preload="metadata": the browser loads only the start, not all 6 MB. */}
            <audio {...player.audioProps} src={data.audio.src} preload="metadata" />
            <PodcastPlayer
              player={player}
              turns={data.turns}
              duration={duration}
              title={data.title}
              summary={data.summary}
              meta={`${data.day} · aus ${data.sourceIds.length} ${data.sourceIds.length === 1 ? "Quelle" : "Quellen"}`}
            />
          </>
        )}
        <Transcript
          turns={data.turns}
          citations={data.citations}
          player={data.audio ? player : null}
          openCitation={openCitation}
          onOpenCitation={setOpenCitation}
        />
      </div>

      <div className="flex min-h-0 flex-col gap-4 lg:flex-[2_1_360px] lg:overflow-y-auto">
        {openCitation ? (
          <div className="flex min-h-[60dvh] flex-1 flex-col rounded-card bg-card p-5 lg:min-h-0">
            <CitationPanel
              open={openCitation}
              onSelect={(n) => setOpenCitation({ ...openCitation, n })}
              onClose={() => setOpenCitation(null)}
            />
          </div>
        ) : (
          <>
            <NewVersion notebookId={data.notebookId} sourceIds={data.sourceIds} />
            {data.audio && <BuildSteps data={data} audio={data.audio} />}
          </>
        )}
      </div>
    </div>
  );
}

function Transcript({
  turns,
  citations,
  player,
  openCitation,
  onOpenCitation,
}: {
  turns: Turn[];
  citations: Citation[];
  player: AudioPlayer | null;
  openCitation: OpenCitation | null;
  onOpenCitation: (open: OpenCitation) => void;
}) {
  // "Mitlesen": highlight the turn that is playing and keep it in view.
  const [follow, setFollow] = useState(true);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const current = player ? currentTurnIndex(turns, player.time) : -1;
  const validNumbers = new Set(citations.map((c) => c.n));

  useEffect(() => {
    if (!follow || current < 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // "nearest": scrolls only if the turn is out of view, and only as far as needed.
    itemRefs.current[current]?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [current, follow]);

  return (
    <section
      aria-labelledby="transcript-heading"
      className="flex flex-col gap-3 rounded-card bg-card p-5 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="transcript-heading" className="text-xl font-medium tracking-tight">
            Transkript
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {turns.length} Redebeiträge · {numberFormat.format(countWords(turns))} Wörter
          </p>
        </div>
        {player && (
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-tile px-3.5 text-[13px] has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
            <input
              type="checkbox"
              checked={follow}
              onChange={(event) => setFollow(event.target.checked)}
              className="size-4 accent-foreground"
            />
            Mitlesen
          </label>
        )}
      </div>

      <ol className="flex flex-col gap-0.5">
        {turns.map((turn, i) => {
          // Audio tags like [laughs] are for the voice, not for the reader.
          const segments = splitCitations(stripAudioTags(turn.text), validNumbers);
          // The citation view knows citations by "messageId". Here: one id per turn.
          const turnKey = `turn-${i}`;
          const activeNumber = openCitation?.messageId === turnKey ? openCitation.n : null;
          const open = (n: number) =>
            onOpenCitation({ messageId: turnKey, n, citations: usedCitations(segments, citations) });
          const speaker = SPEAKERS[turn.speaker];
          const isCurrent = follow && i === current;

          return (
            <li
              key={i}
              ref={(element) => {
                itemRefs.current[i] = element;
              }}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "grid grid-cols-[48px_32px_minmax(0,1fr)] gap-3 rounded-tile px-3 py-2.5 transition-colors motion-reduce:transition-none",
                isCurrent && "bg-highlight-soft",
                // Turns after the current one are grey, as in the design.
                follow && current >= 0 && i > current && "text-muted-foreground",
              )}
            >
              {player && turn.start !== undefined ? (
                <button
                  type="button"
                  onClick={() => player.playFrom(turn.start ?? 0)}
                  aria-label={`Ab ${formatDuration(turn.start)} abspielen`}
                  className={cn(
                    "self-start rounded-md pt-1.5 text-left font-mono text-xs tabular-nums hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatDuration(turn.start)}
                </button>
              ) : (
                <span />
              )}
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-full text-xs font-semibold",
                  turn.speaker === "tom" ? "bg-foreground text-background" : "border border-border bg-tile text-foreground",
                )}
              >
                {speaker.name[0]}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-medium">{speaker.name}</span>
                <p className="text-sm leading-relaxed">
                  <CitedText segments={segments} activeNumber={activeNumber} onOpen={open} />
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// A new episode from the same sources. The current one stays.
function NewVersion({ notebookId, sourceIds }: { notebookId: string; sourceIds: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createStudioItem({ notebookId, sourceIds, kind: "podcast" });
      if (result.error !== null) setError(result.error);
      else router.push(`/notebooks/${notebookId}/studio/${result.itemId}`);
    });
  }

  return (
    <section aria-labelledby="new-version-heading" className="flex flex-col gap-4 rounded-card bg-card p-6">
      <div className="flex flex-col gap-0.5">
        <h2 id="new-version-heading" className="text-xl font-medium tracking-tight">
          Neue Version
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Schreibt und vertont eine neue Folge aus denselben Quellen. Diese Folge bleibt erhalten.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-tile bg-error px-4 py-2.5 text-sm text-error-foreground">
          {error}
        </p>
      )}
      <Button onClick={create} disabled={pending} className="self-start">
        <RefreshCw aria-hidden className={cn(pending && "animate-spin motion-reduce:animate-none")} />
        {pending ? "Wird gestartet …" : "Neu erstellen"}
      </Button>
    </section>
  );
}

// How the episode was made: three finished steps with real numbers.
function BuildSteps({
  data,
  audio,
}: {
  data: PodcastPageData;
  audio: NonNullable<PodcastPageData["audio"]>;
}) {
  const sources = data.sourceIds.length;
  const steps = [
    {
      title: `Skript aus ${sources} ${sources === 1 ? "Quelle" : "Quellen"} geschrieben`,
      detail: `${numberFormat.format(countWords(data.turns))} Wörter · ${data.citations.length} Belege`,
    },
    {
      title: "Sprache erzeugt",
      detail: `${data.turns.length} Redebeiträge einzeln vertont · 2 Stimmen`,
    },
    {
      title: "Zu einer MP3 zusammengefügt",
      detail: `${formatDuration(audio.durationSeconds)} Min. · ${formatMegabytes(audio.sizeBytes)}`,
    },
  ];

  return (
    <section aria-labelledby="build-heading" className="flex flex-col gap-4 rounded-card bg-card p-6">
      <h2 id="build-heading" className="text-xl font-medium tracking-tight">
        So entsteht die Folge
      </h2>
      <ol className="flex flex-col gap-3.5">
        {steps.map((step) => (
          <li key={step.title} className="flex items-start gap-3">
            <span
              aria-hidden
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground"
            >
              <Check className="size-4" strokeWidth={2.4} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{step.title}</span>
              <span className="font-mono text-xs text-muted-foreground">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      {audio.buildSeconds !== null && (
        <p className="border-t border-border pt-3.5 font-mono text-xs text-muted-foreground">
          Erstellt in {formatBuildTime(audio.buildSeconds)}
        </p>
      )}
    </section>
  );
}
