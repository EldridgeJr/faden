import { countTokens } from "./tokens";

// Text of one page. page is null for sources without pages (text, URL).
export type PageText = { page: number | null; text: string };

export type Chunk = {
  content: string;
  page: number | null;
  // Order inside the source, 0, 1, 2, … (unique per source in the database).
  position: number;
  tokenCount: number;
};

export type ChunkOptions = { maxTokens: number; overlapTokens: number };

// About 800 tokens per chunk, 15 % overlap (see CLAUDE.md).
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxTokens: 800,
  overlapTokens: 120,
};

// A sentence (or a piece of a very long sentence). The smallest block we
// never cut. endsParagraph marks the last sentence of a paragraph.
type Unit = { text: string; tokens: number; endsParagraph: boolean };

// Cleans up text from PDFs, web pages and the clipboard.
export function normalizeText(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, "\n")
      // Postgres cannot store the null character in text. Some PDFs contain it.
      .replace(/\u0000/g, "")
      // Soft hyphens are invisible, but they split words for the search.
      .replace(/­/g, "")
      // Hyphenation at the end of a line: "Verarbei-\ntung" → "Verarbeitung".
      // Only between lowercase letters, so "E-\nMail" stays as it is.
      .replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      // An empty line separates paragraphs. More than one carries no meaning.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// Intl.Segmenter (built into Node and browsers) splits text into sentences.
// It also splits after abbreviations like "z. B." or "Dr.". So we glue a
// piece to the next one if it ends in a short word with a dot.
const sentenceSegmenter = new Intl.Segmenter("de", { granularity: "sentence" });
const ENDS_WITH_ABBREVIATION = /(?:^|\s)\p{L}{1,3}\.$/u;

export function splitSentences(paragraph: string): string[] {
  const sentences: string[] = [];
  let pending = "";
  for (const { segment } of sentenceSegmenter.segment(paragraph)) {
    pending += segment;
    if (!ENDS_WITH_ABBREVIATION.test(pending.trimEnd())) {
      sentences.push(pending.trim());
      pending = "";
    }
  }
  if (pending.trim()) sentences.push(pending.trim());
  return sentences.filter(Boolean);
}

// A sentence longer than a whole chunk (tables, lists without full stops):
// cut it at word boundaries into pieces of at most maxTokens.
function splitLongSentence(sentence: string, maxTokens: number): Unit[] {
  const pieces: Unit[] = [];
  let words: string[] = [];
  let tokens = 0;
  for (const word of sentence.split(" ")) {
    const wordTokens = countTokens(" " + word);
    if (tokens + wordTokens > maxTokens && words.length > 0) {
      pieces.push({ text: words.join(" "), tokens, endsParagraph: false });
      words = [];
      tokens = 0;
    }
    words.push(word);
    tokens += wordTokens;
  }
  if (words.length > 0) {
    pieces.push({ text: words.join(" "), tokens, endsParagraph: false });
  }
  return pieces;
}

function toUnits(pageText: string, maxTokens: number): Unit[] {
  const units: Unit[] = [];
  const paragraphs = normalizeText(pageText).split("\n\n");
  for (const paragraph of paragraphs) {
    // Inside a paragraph a single line break is only layout (PDF lines).
    const sentences = splitSentences(paragraph.replace(/\n/g, " "));
    for (const sentence of sentences) {
      const tokens = countTokens(sentence);
      if (tokens > maxTokens) {
        units.push(...splitLongSentence(sentence, maxTokens));
      } else {
        units.push({ text: sentence, tokens, endsParagraph: false });
      }
    }
    if (units.length > 0) units[units.length - 1].endsParagraph = true;
  }
  return units;
}

function joinUnits(units: Unit[]): string {
  return units
    .map((unit, i) => {
      const isLast = i === units.length - 1;
      return unit.text + (isLast ? "" : unit.endsParagraph ? "\n\n" : " ");
    })
    .join("");
}

// Splits the pages of a source into chunks.
//
// Rules:
// 1. A chunk has at most maxTokens tokens. Sentences are never cut
//    (only sentences that alone are longer than a chunk).
// 2. If a chunk is already 75 % full and a paragraph ends, the chunk ends
//    there. So chunks end at paragraphs where possible.
// 3. The next chunk starts with the last sentences of the previous chunk
//    (at most overlapTokens). An answer that sits on the border between
//    two chunks is then still complete in one of them.
// 4. A chunk never crosses a page border. So "page" is always exact and a
//    citation jumps to the right PDF page. The price: no overlap at the
//    border, and the last chunk of a page can be short.
export function chunkPages(
  pages: PageText[],
  { maxTokens, overlapTokens }: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
): Chunk[] {
  const chunks: Chunk[] = [];

  for (const { page, text } of pages) {
    let current: Unit[] = [];
    let currentTokens = 0;
    // False while current holds only the overlap of the previous chunk.
    // Such a chunk would contain no new text, so we never save it.
    let hasNewText = false;

    const closeChunk = () => {
      if (!hasNewText) return;
      const content = joinUnits(current);
      chunks.push({
        content,
        page,
        position: chunks.length,
        tokenCount: countTokens(content),
      });

      // Overlap: take sentences from the end while they fit.
      const overlap: Unit[] = [];
      let overlapSize = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        if (overlapSize + current[i].tokens > overlapTokens) break;
        overlap.unshift(current[i]);
        overlapSize += current[i].tokens;
      }
      current = overlap;
      currentTokens = overlapSize;
      hasNewText = false;
    };

    for (const unit of toUnits(text, maxTokens)) {
      if (currentTokens + unit.tokens > maxTokens) {
        closeChunk();
        // Overlap plus the next sentence can still be too big: drop the overlap.
        if (currentTokens + unit.tokens > maxTokens) {
          current = [];
          currentTokens = 0;
        }
      }
      current.push(unit);
      currentTokens += unit.tokens;
      hasNewText = true;

      if (unit.endsParagraph && currentTokens >= maxTokens * 0.75) {
        closeChunk();
      }
    }
    closeChunk();
  }

  return chunks;
}
