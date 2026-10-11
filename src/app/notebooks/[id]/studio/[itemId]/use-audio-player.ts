"use client";

import { useRef, useState, type SyntheticEvent } from "react";

// Playback speeds, in this order on every click: 1,0× → 1,25× → 1,5× → 2,0× → 1,0×.
const RATES = [1, 1.25, 1.5, 2];

// Controls an <audio> element. The state only mirrors what the element
// reports (play, pause, timeupdate), so display and sound cannot drift apart.
// Spread `audioProps` onto the <audio> element.
export function useAudioPlayer(duration: number) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);

  function play() {
    // play() is refused if the browser blocks it. Nothing to do then: the
    // button simply stays on "Abspielen".
    ref.current?.play().catch(() => {});
  }

  function toggle() {
    if (ref.current?.paused) play();
    else ref.current?.pause();
  }

  function seek(seconds: number) {
    const audio = ref.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(seconds, 0), duration);
    setTime(audio.currentTime);
  }

  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    if (ref.current) ref.current.playbackRate = next;
    setRate(next);
  }

  const audioProps = {
    ref,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    // timeupdate fires about four times per second while playing.
    onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement>) => setTime(event.currentTarget.currentTime),
  };

  return {
    audioProps,
    playing,
    time,
    rate,
    toggle,
    seek,
    skip: (seconds: number) => seek((ref.current?.currentTime ?? 0) + seconds),
    // Jump to a turn and play from there.
    playFrom: (seconds: number) => {
      seek(seconds);
      play();
    },
    cycleRate,
  };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;
