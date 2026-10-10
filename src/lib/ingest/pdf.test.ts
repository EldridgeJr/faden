import { describe, expect, it } from "vitest";
import { makePdf } from "@/test/make-pdf";
import { extractPdfPages, hasTooLittleText } from "./pdf";

describe("extractPdfPages", () => {
  it("returns the text of each page with page numbers from 1", async () => {
    const pdf = makePdf([
      "Erste Seite: Die Kündigungsfrist beträgt drei Monate.",
      "Zweite Seite: Größere Änderungen brauchen eine Übergangszeit.",
    ]);
    const pages = await extractPdfPages(pdf);

    expect(pages).toHaveLength(2);
    expect(pages[0].page).toBe(1);
    expect(pages[0].text).toContain("Kündigungsfrist beträgt drei Monate");
    expect(pages[1].page).toBe(2);
    expect(pages[1].text).toContain("Größere Änderungen");
  });

  it("returns empty text for a page without a text layer", async () => {
    const pages = await extractPdfPages(makePdf(["Text auf Seite 1", null]));
    expect(pages[1].text.trim()).toBe("");
  });

  it("throws for data that is not a PDF", async () => {
    const notAPdf = new TextEncoder().encode("Das ist keine PDF.");
    await expect(extractPdfPages(notAPdf)).rejects.toThrow();
  });
});

describe("hasTooLittleText", () => {
  it("is true for a PDF with only image pages (scan)", async () => {
    const pages = await extractPdfPages(makePdf([null, null, null]));
    expect(hasTooLittleText(pages)).toBe(true);
  });

  it("is false for a PDF with real text", async () => {
    const pages = await extractPdfPages(
      makePdf(["Ein ganz normaler Absatz mit genug Text für eine Seite."]),
    );
    expect(hasTooLittleText(pages)).toBe(false);
  });

  it("is true when there are no pages at all", () => {
    expect(hasTooLittleText([])).toBe(true);
  });

  it("only counts visible characters, not whitespace", () => {
    expect(hasTooLittleText([{ page: 1, text: " \n ".repeat(100) }])).toBe(true);
  });
});
