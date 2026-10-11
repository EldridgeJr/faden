"use client";

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { formatDuration } from "@/lib/format";
import { currentTurnIndex, SPEAKERS, type Turn } from "@/lib/studio/podcast";
import { cn } from "@/lib/utils";
import type { AudioPlayer } from "./use-audio-player";

const rateFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1 });

// The dark player card: status, title, speaker track, controls.
export function PodcastPlayer({
  player,
  turns,
  duration,
  title,
  summary,
  meta,
}: {
  player: AudioPlayer;
  turns: Turn[];
  duration: number;
  title: string;
  summary: string;
  // "Heute · aus 3 Quellen"
  meta: string;
}) {
  const current = currentTurnIndex(turns, player.time);
  const speaker = current >= 0 ? SPEAKERS[turns[current].speaker] : null;

  return (
    <section
      aria-label="Audio-Player"
      className="flex flex-col gap-[18px] rounded-card bg-player p-6 text-player-foreground sm:p-7"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs">
          <span aria-hidden className="size-[7px] rounded-full bg-ready" />
          Bereit
        </span>
        <span className="font-mono text-xs text-player-muted">{meta}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-balance">{title}</h2>
        {summary && <p className="text-[15px] text-player-muted">{summary}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <SpeakerTrack player={player} turns={turns} duration={duration} />
        <div className="flex justify-between font-mono text-xs tabular-nums">
          <span>{formatDuration(player.time)}</span>
          <span className="text-player-muted">{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Small screens: the buttons on top, speaker and speed below.
          From sm on: one row, speaker · buttons · speed. */}
      <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {/* aria-live: screen readers hear who speaks when it changes. */}
        <div
          aria-live="polite"
          className="flex min-w-0 items-center gap-2 text-[13px] text-player-muted sm:col-start-1 sm:row-start-1"
        >
          {speaker && (
            <>
              <span
                aria-hidden
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#111315]"
              >
                {speaker.name[0]}
              </span>
              {player.playing ? `${speaker.name} spricht` : "Pausiert"}
            </>
          )}
        </div>

        <div className="col-span-2 row-start-1 flex items-center justify-self-center gap-3.5 sm:col-span-1 sm:col-start-2">
          <RoundButton label="15 Sekunden zurück" onClick={() => player.skip(-15)}>
            <RotateCcw aria-hidden className="size-5" />
          </RoundButton>
          <button
            type="button"
            onClick={player.toggle}
            aria-label={player.playing ? "Pausieren" : "Abspielen"}
            className="inline-flex size-16 items-center justify-center rounded-full bg-highlight text-highlight-foreground transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-highlight/50 focus-visible:outline-none motion-reduce:transition-none"
          >
            {player.playing ? (
              <Pause aria-hidden className="size-6 fill-current" />
            ) : (
              <Play aria-hidden className="ml-1 size-6 fill-current" />
            )}
          </button>
          <RoundButton label="15 Sekunden vor" onClick={() => player.skip(15)}>
            <RotateCw aria-hidden className="size-5" />
          </RoundButton>
        </div>

        <div className="flex justify-end sm:col-start-3 sm:row-start-1">
          <button
            type="button"
            onClick={player.cycleRate}
            aria-label={`Tempo ${rateFormat.format(player.rate)}-fach, klicken zum Ändern`}
            className="h-9 rounded-full border border-player-line px-3.5 font-mono text-[13px] transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none"
          >
            {rateFormat.format(player.rate)}×
          </button>
        </div>
      </div>
    </section>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-12 items-center justify-center rounded-full border border-player-line transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

// The progress bar: one segment per turn, as wide as the turn is long.
// Lea's segments are a bit taller than Tom's, so you see who speaks when.
// This is real data from the MP3, not a decorative waveform.
//
// Two layers of the same segments: grey below, lime on top. The lime layer
// is cut off at the play position (clip-path), so the played part is lime.
// A transparent range input on top makes it work with mouse, touch,
// keyboard and screen readers without own code for that.
function SpeakerTrack({ player, turns, duration }: { player: AudioPlayer; turns: Turn[]; duration: number }) {
  const progress = duration > 0 ? Math.min(player.time / duration, 1) : 0;

  const segments = (className: string) => (
    <div aria-hidden className="absolute inset-0 flex items-center gap-[3px]">
      {turns.map((turn, i) => {
        const end = turns[i + 1]?.start ?? duration;
        const length = Math.max(end - (turn.start ?? 0), 0);
        return (
          <span
            key={i}
            style={{ flexGrow: length }}
            className={cn("min-w-[3px] basis-0 rounded-full", turn.speaker === "lea" ? "h-5" : "h-3", className)}
          />
        );
      })}
    </div>
  );

  return (
    // The range input is invisible, so the frame shows its keyboard focus.
    <div className="relative h-12 rounded-lg has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-white/40">
      {segments("bg-player-track")}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}>
        {segments("bg-highlight")}
      </div>
      {/* Play position: a white line with a dot. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2 rounded-full bg-white"
        style={{ left: `${progress * 100}%` }}
      >
        <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-white" />
      </span>
      <input
        type="range"
        min={0}
        max={duration}
        step={1}
        value={player.time}
        onChange={(event) => player.seek(Number(event.target.value))}
        aria-label="Position in der Folge"
        aria-valuetext={`${formatDuration(player.time)} von ${formatDuration(duration)}`}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
