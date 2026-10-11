import { formatDay, formatDuration } from "@/lib/format";
import { flashcardsDataSchema } from "./flashcards";
import { describeProgress, podcastDataSchema } from "./podcast";
import { STUCK_MESSAGE, studioState, type StudioState } from "./status";

// What the studio column shows for one item.
export type StudioItemSummary = {
  id: string;
  kind: string;
  state: StudioState;
  title: string;
  // "12 Karten" or "5:12 Min.", only when ready.
  detail: string | null;
  // "Sprache wird erzeugt: 12 von 29", only while busy (podcast).
  progress: string | null;
  error: string | null;
  // "Heute", "Gestern", "6. Okt.": computed on the server, so server and
  // browser render the same text.
  day: string;
};

export const KIND_LABELS: Record<string, string> = {
  flashcards: "Karteikarten",
  podcast: "Audio-Zusammenfassung",
};

type StudioRow = {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  data: unknown;
  created_at: string;
};

export function summarizeStudioItem(row: StudioRow, now: Date): StudioItemSummary {
  const state = studioState(row.status, row.created_at, now);
  const label = KIND_LABELS[row.kind] ?? "Studio";
  let title = label;
  let detail: string | null = null;
  let progress: string | null = null;

  if (row.kind === "flashcards") {
    // data is free JSON from the database: check it, never trust it.
    const data = flashcardsDataSchema.safeParse(row.data);
    if (data.success && data.data.title) title = data.data.title;
    if (state === "ready" && data.success && data.data.cards) {
      const count = data.data.cards.length;
      detail = `${count} ${count === 1 ? "Karte" : "Karten"}`;
    }
  }

  if (row.kind === "podcast") {
    const data = podcastDataSchema.safeParse(row.data);
    if (data.success && data.data.title) title = data.data.title;
    if (state === "busy" && data.success) progress = describeProgress(data.data.progress);
    if (state === "ready" && data.success && data.data.durationSeconds !== undefined) {
      detail = `${formatDuration(data.data.durationSeconds)} Min.`;
    }
  }

  return {
    id: row.id,
    kind: row.kind,
    state,
    title,
    detail,
    progress,
    // A stuck job has no error text in the database.
    error: state === "error" ? (row.error ?? STUCK_MESSAGE) : null,
    day: formatDay(new Date(row.created_at), now),
  };
}
