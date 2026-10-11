import { describe, expect, it } from "vitest";
import { chunkPages } from "@/lib/ingest/chunk";
import { assembleChunks, overlapLength } from "./assemble";

// A German sentence of 27 tokens, numbered so every sentence is unique.
const sentence = (n: number) =>
  `Satz ${n} beschreibt, wie die Verarbeitung der hochgeladenen Quellen im Hintergrund funktioniert.`;
const paragraph = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => sentence(from + i)).join(" ");

describe("overlapLength", () => {
  it("finds whole sentences at the end of one and the start of the other", () => {
    expect(overlapLength("Eins. Zwei. Drei.", "Zwei. Drei. Vier.")).toBe("Zwei. Drei.".length);
  });

  it("ignores a chance match that is not a whole sentence", () => {
    // "Haus." ends the first, "Haus" starts the second, but inside a word.
    expect(overlapLength("Das ist das Haus.", "Haus.ordnung gilt.")).toBe(0);
    expect(overlapLength("Er kam nach Hause", "e und blieb.")).toBe(0);
  });

  it("returns 0 without overlap", () => {
    expect(overlapLength("Erster Abschnitt.", "Zweiter Abschnitt.")).toBe(0);
  });
});

describe("assembleChunks", () => {
  it("rebuilds the original text from overlapping chunks", () => {
    const original = [paragraph(1, 6), paragraph(7, 5), paragraph(12, 7)].join("\n\n");
    // Small chunks: many chunk borders, each with an overlap of one sentence.
    const chunks = chunkPages([{ page: 1, text: original }], { maxTokens: 100, overlapTokens: 30 });
    expect(chunks.length).toBeGreaterThan(4);

    const { text, ranges } = assembleChunks(chunks.map((c, i) => ({ id: i, content: c.content })));

    expect(text).toBe(original);
    // Every sentence exactly once: no duplicates from the overlap.
    for (let n = 1; n <= 18; n++) {
      expect(text.split(sentence(n)).length - 1).toBe(1);
    }
    // Every range points exactly at its chunk.
    for (const [i, chunk] of chunks.entries()) {
      expect(text.slice(ranges[i].start, ranges[i].end)).toBe(chunk.content);
    }
  });

  it("joins chunks without overlap with an empty line", () => {
    const { text, ranges } = assembleChunks([
      { id: 10, content: "Erster Abschnitt." },
      { id: 11, content: "Zweiter Abschnitt." },
    ]);
    expect(text).toBe("Erster Abschnitt.\n\nZweiter Abschnitt.");
    expect(ranges).toEqual([
      { id: 10, start: 0, end: 17 },
      { id: 11, start: 19, end: 37 },
    ]);
  });

  it("handles an empty list", () => {
    expect(assembleChunks([])).toEqual({ text: "", ranges: [] });
  });
});
