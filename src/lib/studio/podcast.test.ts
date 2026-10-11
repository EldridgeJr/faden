import { describe, expect, it } from "vitest";
import {
  buildPodcastInstructions,
  cleanScript,
  countWords,
  describeProgress,
  MAX_TURNS,
  scriptCitations,
  spokenText,
} from "./podcast";

describe("cleanScript", () => {
  it("keeps good turns unchanged", () => {
    const turns = [
      { speaker: "lea" as const, text: "Willkommen bei Faden!" },
      { speaker: "tom" as const, text: "Nachtruhe gilt ab 22 Uhr [1]." },
    ];
    expect(cleanScript(turns, 3)).toEqual(turns);
  });

  it("removes citation numbers outside 1..count", () => {
    const [turn] = cleanScript([{ speaker: "tom", text: "Ab 22 Uhr [1, 7]." }], 3);
    expect(turn.text).toBe("Ab 22 Uhr [1].");
  });

  it("drops empty turns and turns that are only a citation", () => {
    const turns = cleanScript(
      [
        { speaker: "lea", text: "  " },
        { speaker: "tom", text: "[2]" },
        { speaker: "lea", text: "Danke fürs Zuhören." },
      ],
      3,
    );
    expect(turns).toEqual([{ speaker: "lea", text: "Danke fürs Zuhören." }]);
  });

  it(`keeps at most ${MAX_TURNS} turns`, () => {
    const turns = Array.from({ length: 80 }, () => ({ speaker: "lea" as const, text: "Hallo." }));
    expect(cleanScript(turns, 3)).toHaveLength(MAX_TURNS);
  });
});

describe("scriptCitations", () => {
  it("collects the numbers of all turns", () => {
    const turns = [
      { speaker: "lea" as const, text: "Frage?" },
      { speaker: "tom" as const, text: "A [3]. B [1][3]." },
    ];
    expect(scriptCitations(turns, 3)).toEqual([1, 3]);
  });
});

describe("spokenText", () => {
  it("removes citations, so the voice does not read them", () => {
    expect(spokenText("Ab 22 Uhr [1]. Auch sonntags [2][3].")).toBe("Ab 22 Uhr. Auch sonntags.");
  });

  it("joins line breaks and double spaces", () => {
    expect(spokenText("Erster Satz.\n\nZweiter  Satz.")).toBe("Erster Satz. Zweiter Satz.");
  });
});

describe("countWords", () => {
  it("counts spoken words, not citations", () => {
    const turns = [
      { speaker: "lea" as const, text: "Willkommen bei Faden!" },
      { speaker: "tom" as const, text: "Ruhe ab 22 Uhr [1]." },
    ];
    expect(countWords(turns)).toBe(7);
  });
});

describe("buildPodcastInstructions", () => {
  const chunks = [
    { sourceTitle: "Hausordnung", page: 2, content: "Ruhe ab 22 Uhr." },
    { sourceTitle: "Notiz", page: null, content: "Der Hof ist offen." },
  ];

  it("names the valid numbers and contains the numbered sources", () => {
    const prompt = buildPodcastInstructions(chunks);
    expect(prompt).toContain("nur die Nummern 1 bis 2");
    expect(prompt).toContain('<quelle nr="1">\nTitel: Hausordnung · Seite 2\nRuhe ab 22 Uhr.\n</quelle>');
  });

  it("puts roles and rules before the sources", () => {
    const prompt = buildPodcastInstructions(chunks);
    expect(prompt.indexOf("Regeln:")).toBeLessThan(prompt.indexOf("<quelle"));
    expect(prompt.indexOf("Rollen:")).toBeLessThan(prompt.indexOf("Regeln:"));
  });
});

describe("describeProgress", () => {
  it("names the stage and counts the spoken turns", () => {
    expect(describeProgress(undefined)).toBeNull();
    expect(describeProgress({ stage: "script" })).toBe("Skript wird geschrieben …");
    expect(describeProgress({ stage: "audio", done: 12, total: 29 })).toBe("Sprache wird erzeugt: 12 von 29");
    expect(describeProgress({ stage: "upload" })).toBe("MP3 wird gespeichert …");
  });
});
