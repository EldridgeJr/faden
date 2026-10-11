import { describe, expect, it } from "vitest";
import { summarizeNotebooks, type NotebookRow, type QuestionRow } from "./notebook-overview";

const notebooks: NotebookRow[] = [
  {
    id: "old",
    title: "Alt, aber gerade benutzt",
    created_at: "2026-10-01T10:00:00Z",
    sources: [{ status: "ready" }, { status: "processing" }, { status: "pending" }, { status: "error" }],
  },
  { id: "new", title: "Neu, ohne Fragen", created_at: "2026-10-10T10:00:00Z", sources: [] },
];

// Newest first, as the query returns them.
const questions: QuestionRow[] = [
  { notebook_id: "old", content: "Neueste Frage", created_at: "2026-10-11T09:00:00Z" },
  { notebook_id: "old", content: "Ältere Frage", created_at: "2026-10-11T08:00:00Z" },
];

describe("summarizeNotebooks", () => {
  it("sorts by last activity: a question counts more than the creation date", () => {
    const result = summarizeNotebooks(notebooks, questions);
    expect(result.map((n) => n.id)).toEqual(["old", "new"]);
  });

  it("takes the latest question of each notebook", () => {
    const [old, fresh] = summarizeNotebooks(notebooks, questions);
    expect(old.lastQuestion).toBe("Neueste Frage");
    expect(old.lastActivityAt).toBe("2026-10-11T09:00:00Z");
    expect(fresh.lastQuestion).toBeNull();
    expect(fresh.lastActivityAt).toBe("2026-10-10T10:00:00Z");
  });

  it("counts sources by status; waiting and processing are both busy", () => {
    const [old] = summarizeNotebooks(notebooks, questions);
    expect(old).toMatchObject({ sourceCount: 4, ready: 1, busy: 2, failed: 1 });
  });
});
