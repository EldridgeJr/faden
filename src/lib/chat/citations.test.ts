import { describe, expect, it } from "vitest";
import { findCitations, splitCitations } from "./citations";

describe("findCitations", () => {
  it("finds single citations, sorted and without duplicates", () => {
    expect(findCitations("A [3]. B [1]. C [3].", 8)).toEqual([1, 3]);
  });

  it("finds lists and neighbours", () => {
    expect(findCitations("A [1, 2]. B [4][5].", 8)).toEqual([1, 2, 4, 5]);
  });

  it("drops numbers outside 1 to count", () => {
    expect(findCitations("A [0]. B [9]. C [2].", 8)).toEqual([2]);
  });

  it("ignores ranges and other brackets", () => {
    expect(findCitations("A [1-3]. B [Quelle]. C [ ].", 8)).toEqual([]);
  });

  it("returns nothing for the no-answer sentence", () => {
    expect(findCitations("Dazu habe ich in deinen Quellen nichts gefunden.", 8)).toEqual([]);
  });
});

describe("splitCitations", () => {
  const valid = new Set([1, 2, 3]);

  it("turns citations into their own segments", () => {
    expect(splitCitations("Ruhe ab 22 Uhr [1].", valid)).toEqual([
      { type: "text", text: "Ruhe ab 22 Uhr " },
      { type: "citation", n: 1 },
      { type: "text", text: "." },
    ]);
  });

  it("splits a list into one segment per number", () => {
    expect(splitCitations("A [1, 3]", valid)).toEqual([
      { type: "text", text: "A " },
      { type: "citation", n: 1 },
      { type: "citation", n: 3 },
    ]);
  });

  it("keeps neighbouring citations apart", () => {
    expect(splitCitations("[2][3]", valid)).toEqual([
      { type: "citation", n: 2 },
      { type: "citation", n: 3 },
    ]);
  });

  it("keeps unknown numbers as plain text", () => {
    expect(splitCitations("A [9] und [1, 9].", valid)).toEqual([
      { type: "text", text: "A [9] und [1, 9]." },
    ]);
  });

  it("keeps HTML as plain text", () => {
    const text = "<img src=x onerror=alert(1)> [1]";
    expect(splitCitations(text, valid)).toEqual([
      { type: "text", text: "<img src=x onerror=alert(1)> " },
      { type: "citation", n: 1 },
    ]);
  });

  it("returns nothing for an empty answer", () => {
    expect(splitCitations("", valid)).toEqual([]);
  });
});
