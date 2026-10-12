import { describe, expect, it } from "vitest";
import {
  buildPodcastInstructions,
  cleanScript,
  countWords,
  currentTurnIndex,
  describeProgress,
  downloadFileName,
  keepKnownTags,
  MAX_TURNS,
  scriptCitations,
  spokenText,
  stripAudioTags,
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

  it("asks for a number of turns, not for a number of words", () => {
    const prompt = buildPodcastInstructions(chunks);
    expect(prompt).toContain("20 bis 24 Redebeiträge");
    expect(prompt).toContain("höchstens 40 Wörter");
  });

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

describe("currentTurnIndex", () => {
  const turns = [
    { speaker: "lea" as const, text: "A", start: 0 },
    { speaker: "tom" as const, text: "B", start: 13.4 },
    { speaker: "lea" as const, text: "C", start: 46.5 },
  ];

  it("finds the turn that has started last", () => {
    expect(currentTurnIndex(turns, 0)).toBe(0);
    expect(currentTurnIndex(turns, 13.39)).toBe(0);
    expect(currentTurnIndex(turns, 13.4)).toBe(1);
    expect(currentTurnIndex(turns, 300)).toBe(2);
  });

  it("returns -1 without start times", () => {
    expect(currentTurnIndex([{ speaker: "lea", text: "A" }], 5)).toBe(-1);
  });
});

describe("downloadFileName", () => {
  it("writes umlauts out and keeps only a–z, 0–9 and dashes", () => {
    expect(downloadFileName("Das Völkerschlachtdenkmal in Leipzig")).toBe(
      "das-voelkerschlachtdenkmal-in-leipzig.mp3",
    );
    expect(downloadFileName("Straße: Regeln & Ruhe?")).toBe("strasse-regeln-ruhe.mp3");
  });

  it("falls back to a fixed name", () => {
    expect(downloadFileName("???")).toBe("audio-zusammenfassung.mp3");
  });
});

describe("audio tags", () => {
  it("keeps allowed tags in lower case and leaves citations alone", () => {
    expect(keepKnownTags("[Laughs] Genau so [3].")).toBe("[laughs] Genau so [3].");
  });

  it("removes tags that are not allowed, with the space before them", () => {
    expect(keepKnownTags("Ja [lacht] genau [Musik].")).toBe("Ja genau.");
  });

  it("strips all tags for the transcript, but keeps citations", () => {
    expect(stripAudioTags("[excited] Hallo! Ruhe ab 22 Uhr [2]. [laughs] Ja.")).toBe("Hallo! Ruhe ab 22 Uhr [2]. Ja.");
  });

  it("keeps tags for the voice but removes citations", () => {
    expect(spokenText("[laughs] Ab 22 Uhr [1].")).toBe("[laughs] Ab 22 Uhr.");
  });

  it("drops a turn that is only a tag, and does not count tags as words", () => {
    const turns = cleanScript(
      [
        { speaker: "lea", text: "[laughs]" },
        { speaker: "tom", text: "[curious] Und dann [1]?" },
      ],
      3,
    );
    expect(turns).toEqual([{ speaker: "tom", text: "[curious] Und dann [1]?" }]);
    expect(countWords(turns)).toBe(2);
  });

  it("lists the allowed tags in the prompt", () => {
    const prompt = buildPodcastInstructions([{ sourceTitle: "A", page: null, content: "B" }]);
    expect(prompt).toContain("[laughs], [excited], [curious], [sighs], [thoughtful], [surprised]");
    expect(prompt).toContain("in etwa jedem zweiten Redebeitrag");
  });
});
