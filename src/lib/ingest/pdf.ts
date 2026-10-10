import { extractText } from "unpdf";
import type { PageText } from "./chunk";

// Below this average a PDF has no real text layer. Typical case: a scan,
// where every page is only an image. Real text pages have hundreds of chars.
export const MIN_CHARS_PER_PAGE = 20;

// Returns the text of every page, page numbers start at 1.
// unpdf ships a build of Mozilla's PDF.js that runs on serverless platforms.
// We pass the raw bytes: unpdf then opens the document and closes it again
// itself, even if an error happens.
// Throws for broken or password-protected PDFs. The caller handles that.
export async function extractPdfPages(data: Uint8Array): Promise<PageText[]> {
  const { text } = await extractText(data, { mergePages: false });
  return text.map((pageText, i) => ({ page: i + 1, text: pageText }));
}

// True if the PDF has (almost) no text. We cannot read it without OCR,
// so the source gets the status "error" with a clear message.
export function hasTooLittleText(pages: PageText[]): boolean {
  if (pages.length === 0) return true;
  const chars = pages.reduce(
    (sum, page) => sum + page.text.replace(/\s/g, "").length,
    0,
  );
  return chars / pages.length < MIN_CHARS_PER_PAGE;
}
