import { describe, expect, it } from "vitest";
import { chunkPages, normalizeText, splitSentences } from "./chunk";
import { countTokens } from "./tokens";

// A German sentence of 27 tokens (cl100k_base). Numbered, so every sentence is unique.
const sentence = (n: number) =>
  `Satz ${n} beschreibt, wie die Verarbeitung der hochgeladenen Quellen im Hintergrund funktioniert.`;
const sentences = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => sentence(from + i)).join(" ");

describe("normalizeText", () => {
  it("joins words hyphenated at the end of a line", () => {
    expect(normalizeText("die Verarbei-\ntung")).toBe("die Verarbeitung");
  });

  it("keeps a real hyphen before an uppercase letter", () => {
    expect(normalizeText("per E-\nMail")).toBe("per E-\nMail");
  });

  it("unifies line breaks, spaces and empty lines", () => {
    expect(normalizeText("  a  b\r\nc\n\n\n\nd ­ ")).toBe("a b\nc\n\nd");
  });
});

describe("splitSentences", () => {
  it("does not split after abbreviations", () => {
    expect(
      splitSentences("Das ist z. B. ein Satz. Hier kommt Dr. Müller! Und noch einer?"),
    ).toEqual(["Das ist z. B. ein Satz.", "Hier kommt Dr. Müller!", "Und noch einer?"]);
  });
});

describe("chunkPages", () => {
  it("keeps a short text in one chunk", () => {
    const chunks = chunkPages([{ page: 3, text: "Ein kurzer Absatz." }]);
    expect(chunks).toEqual([
      {
        content: "Ein kurzer Absatz.",
        page: 3,
        position: 0,
        tokenCount: countTokens("Ein kurzer Absatz."),
      },
    ]);
  });

  it("returns no chunks for empty pages, and positions stay continuous", () => {
    const chunks = chunkPages([
      { page: 1, text: "Seite eins." },
      { page: 2, text: "   " },
      { page: 3, text: "Seite drei." },
    ]);
    expect(chunks.map((c) => [c.page, c.position])).toEqual([
      [1, 0],
      [3, 1],
    ]);
  });

  it("keeps every chunk at or below the token limit", () => {
    const chunks = chunkPages([{ page: null, text: sentences(1, 200) }]);
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      // Small margin: joining sentences with a space can change the count by a token.
      expect(chunk.tokenCount).toBeLessThanOrEqual(800 + 5);
    }
  });

  it("starts each chunk with the end of the previous one (overlap)", () => {
    const chunks = chunkPages([{ page: null, text: sentences(1, 200) }]);
    for (let i = 1; i < chunks.length; i++) {
      // The overlap is the tail of the previous chunk, from the sentence the
      // next chunk starts with. The next chunk must begin with exactly that.
      const firstSentence = chunks[i].content.split(". ")[0] + ".";
      const start = chunks[i - 1].content.indexOf(firstSentence);
      const overlap = chunks[i - 1].content.slice(start);

      expect(start).toBeGreaterThan(0);
      expect(chunks[i].content.startsWith(overlap)).toBe(true);
      expect(countTokens(overlap)).toBeLessThanOrEqual(120);
    }
  });

  it("loses no sentence", () => {
    const chunks = chunkPages([{ page: null, text: sentences(1, 200) }]);
    const all = chunks.map((c) => c.content).join(" ");
    for (let n = 1; n <= 200; n++) {
      expect(all).toContain(sentence(n));
    }
  });

  it("ends chunks at paragraphs when they are full enough", () => {
    // Three paragraphs of 12 sentences (about 324 tokens each). Two paragraphs
    // are more than 75 % of 800 tokens, three do not fit. So the first chunk
    // must end exactly after the second paragraph (sentence 112).
    const paragraphs = [sentences(1, 12), sentences(101, 12), sentences(201, 12)];
    const chunks = chunkPages([{ page: null, text: paragraphs.join("\n\n") }]);
    expect(chunks[0].content.endsWith(sentence(112))).toBe(true);
    expect(chunks[0].content).toContain("\n\n");
  });

  it("never crosses a page border", () => {
    // Page 1 has sentences 1 to 60, page 2 has sentences 1001 to 1060.
    const chunks = chunkPages([
      { page: 1, text: sentences(1, 60) },
      { page: 2, text: sentences(1001, 60) },
    ]);
    for (const chunk of chunks) {
      const numbers = [...chunk.content.matchAll(/Satz (\d+) /g)].map((m) => Number(m[1]));
      const expectedPage = numbers[0] > 1000 ? 2 : 1;
      expect(chunk.page).toBe(expectedPage);
      expect(numbers.every((n) => (n > 1000 ? 2 : 1) === expectedPage)).toBe(true);
    }
  });

  it("splits a sentence that alone is longer than a chunk", () => {
    const longSentence = Array.from({ length: 1200 }, (_, i) => `Wort${i}`).join(" ");
    const chunks = chunkPages([{ page: null, text: longSentence }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(800 + 5);
    }
    expect(chunks.map((c) => c.content).join(" ")).toContain("Wort1199");
  });

  it("does not crash on special tokens in the text", () => {
    expect(() => chunkPages([{ page: 1, text: "Text mit <|endoftext|> darin." }])).not.toThrow();
  });
});
