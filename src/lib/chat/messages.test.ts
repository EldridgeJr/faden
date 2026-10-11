import { describe, expect, it } from "vitest";
import { toChatMessages } from "./messages";

const citation = {
  n: 2,
  chunkId: 17,
  sourceId: "6f1c3c55-6a51-4d2f-9a49-2f0f7c1d9b10",
  sourceTitle: "Hausordnung",
  page: 2,
  position: 1,
  content: "Ruhe ab 22 Uhr.",
};

describe("toChatMessages", () => {
  it("turns a question into a user message with one text part", () => {
    const [message] = toChatMessages([
      { id: "a", role: "user", content: "Wann ist Ruhe?", citations: [] },
    ]);
    expect(message).toEqual({
      id: "a",
      role: "user",
      parts: [{ type: "text", text: "Wann ist Ruhe?" }],
    });
  });

  it("puts the saved citations before the text of an answer", () => {
    const [message] = toChatMessages([
      { id: "b", role: "assistant", content: "Ab 22 Uhr [2].", citations: [citation] },
    ]);
    expect(message.parts).toEqual([
      { type: "data-citations", id: "citations", data: [citation] },
      { type: "text", text: "Ab 22 Uhr [2]." },
    ]);
  });

  it("shows the text without citations if the saved JSON is broken", () => {
    const [message] = toChatMessages([
      { id: "c", role: "assistant", content: "Ab 22 Uhr [2].", citations: [{ n: "zwei" }] },
    ]);
    expect(message.parts[0]).toEqual({ type: "data-citations", id: "citations", data: [] });
  });
});
