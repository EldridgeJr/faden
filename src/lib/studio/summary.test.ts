import { describe, expect, it } from "vitest";
import { STUCK_MESSAGE } from "./status";
import { summarizeStudioItem } from "./summary";

const now = new Date("2026-10-11T12:00:00Z");
const sourceId = "7b1c2a5e-1111-4222-8333-944455556666";

function row(overrides: Partial<Parameters<typeof summarizeStudioItem>[0]>) {
  return {
    id: "item",
    kind: "flashcards",
    status: "ready",
    error: null,
    data: { sourceIds: [sourceId] },
    created_at: "2026-10-11T11:59:00Z",
    ...overrides,
  };
}

describe("summarizeStudioItem", () => {
  it("shows title and card count of a ready deck", () => {
    const data = {
      sourceIds: [sourceId],
      title: "Hausordnung kompakt",
      cards: [
        { front: "A?", back: "B [1]." },
        { front: "C?", back: "D [1]." },
      ],
      citations: [],
    };
    const summary = summarizeStudioItem(row({ data }), now);
    expect(summary).toMatchObject({ state: "ready", title: "Hausordnung kompakt", detail: "2 Karten" });
  });

  it("uses the kind as title while the deck is being made", () => {
    const summary = summarizeStudioItem(row({ status: "processing" }), now);
    expect(summary).toMatchObject({ state: "busy", title: "Karteikarten", detail: null, error: null });
  });

  it("shows the error text of a failed job", () => {
    const summary = summarizeStudioItem(row({ status: "error", error: "Zu wenig Text." }), now);
    expect(summary).toMatchObject({ state: "error", error: "Zu wenig Text." });
  });

  it("shows a stuck job as an error with a message", () => {
    const summary = summarizeStudioItem(
      row({ status: "processing", created_at: "2026-10-11T11:00:00Z" }),
      now,
    );
    expect(summary).toMatchObject({ state: "error", error: STUCK_MESSAGE });
  });

  it("survives broken data from the database", () => {
    const summary = summarizeStudioItem(row({ data: { cards: "kaputt" } }), now);
    expect(summary).toMatchObject({ title: "Karteikarten", detail: null });
  });
});
