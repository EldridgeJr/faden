import { describe, expect, it } from "vitest";
import { buildFlashcardsInstructions, cleanFlashcards, MAX_FLASHCARDS } from "./flashcards";

describe("cleanFlashcards", () => {
  it("keeps a good card unchanged", () => {
    const cards = [{ front: "Ab wann gilt Nachtruhe?", back: "Ab 22 Uhr [1]." }];
    expect(cleanFlashcards(cards, 3)).toEqual(cards);
  });

  it("drops a card without a citation (maybe the model's own knowledge)", () => {
    const cards = [
      { front: "Wer erfand den Buchdruck?", back: "Gutenberg." },
      { front: "Ab wann gilt Nachtruhe?", back: "Ab 22 Uhr [1]." },
    ];
    expect(cleanFlashcards(cards, 3)).toHaveLength(1);
  });

  it("drops a card whose only citation points to nothing", () => {
    expect(cleanFlashcards([{ front: "Frage?", back: "Antwort [9]." }], 3)).toEqual([]);
  });

  it("removes unknown numbers but keeps the valid ones", () => {
    const [card] = cleanFlashcards([{ front: "Frage?", back: "Antwort [2, 9]." }], 3);
    expect(card.back).toBe("Antwort [2].");
  });

  it("removes citations from the front", () => {
    const [card] = cleanFlashcards([{ front: "Ab wann gilt Nachtruhe [1]?", back: "Ab 22 Uhr [1]." }], 3);
    expect(card.front).toBe("Ab wann gilt Nachtruhe?");
  });

  it("drops cards with an empty front", () => {
    expect(cleanFlashcards([{ front: "  ", back: "Antwort [1]." }], 3)).toEqual([]);
  });

  it(`keeps at most ${MAX_FLASHCARDS} cards`, () => {
    const cards = Array.from({ length: 20 }, (_, i) => ({ front: `Frage ${i}?`, back: "Antwort [1]." }));
    expect(cleanFlashcards(cards, 3)).toHaveLength(MAX_FLASHCARDS);
  });
});

describe("buildFlashcardsInstructions", () => {
  const chunks = [
    { sourceTitle: "Hausordnung", page: 2, content: "Ruhe ab 22 Uhr." },
    { sourceTitle: "Notiz", page: null, content: "Der Hof ist offen." },
  ];

  it("names the valid numbers and contains the numbered sources", () => {
    const prompt = buildFlashcardsInstructions(chunks);
    expect(prompt).toContain("nur die Nummern 1 bis 2");
    expect(prompt).toContain('<quelle nr="2">\nTitel: Notiz\nDer Hof ist offen.\n</quelle>');
  });

  it("puts the rules before the sources", () => {
    const prompt = buildFlashcardsInstructions(chunks);
    expect(prompt.indexOf("Regeln:")).toBeLessThan(prompt.indexOf("<quelle"));
  });
});
