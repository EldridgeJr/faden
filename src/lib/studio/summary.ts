import { formatDay } from "@/lib/format";
import { flashcardsDataSchema } from "./flashcards";
import { podcastDataSchema } from "./podcast";
import { STUCK_MESSAGE, studioState, type StudioState } from "./status";

// What the studio column shows for one item.
export type StudioItemSummary = {
  id: string;
  kind: string;
  state: StudioState;
  title: string;
  // "12 Karten" or "24 Redebeiträge", only when ready.
  detail: string | null;
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
    if (state === "ready" && data.success && data.data.turns) {
      const count = data.data.turns.length;
      detail = `${count} ${count === 1 ? "Redebeitrag" : "Redebeiträge"}`;
    }
  }

  return {
    id: row.id,
    kind: row.kind,
    state,
    title,
    detail,
    // A stuck job has no error text in the database.
    error: state === "error" ? (row.error ?? STUCK_MESSAGE) : null,
    day: formatDay(new Date(row.created_at), now),
  };
}
