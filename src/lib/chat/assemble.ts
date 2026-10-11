// Puts the chunks of one page back together into one text, for the
// citation view. Used in the API route, tested with Vitest.
//
// The problem: neighbouring chunks overlap (see chunkPages in
// src/lib/ingest/chunk.ts). Chunk n+1 starts with the last sentences of
// chunk n. Simply joining them would show these sentences twice.
//
// The solution: find the overlap and add only the new part. The overlap is
// the longest end of chunk n that is also the start of chunk n+1.

export type ChunkPiece = { id: number; content: string };
export type ChunkRange = { id: number; start: number; end: number };

// The overlap is at most 120 tokens, roughly 600 characters. We look a bit
// further to be safe, but not through the whole chunk.
const MAX_OVERLAP_CHARS = 2000;

// Separator when two chunks do not overlap (start of a page, or the overlap
// was dropped because it did not fit). We cannot know the original one.
const NO_OVERLAP_SEPARATOR = "\n\n";

const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char);

// Length of the overlap between the end of `previous` and the start of
// `next`, or 0. The overlap is made of whole sentences, so it must start
// after a space in `previous` and be followed by a space (or the end) in
// `next`. This stops a chance match like a single "e".
export function overlapLength(previous: string, next: string): number {
  const max = Math.min(previous.length, next.length, MAX_OVERLAP_CHARS);
  for (let length = max; length > 0; length--) {
    if (!isSpace(previous[previous.length - length - 1])) continue;
    if (!isSpace(next[length])) continue;
    if (previous.endsWith(next.slice(0, length))) return length;
  }
  return 0;
}

// chunks must be in reading order (by position).
// Returns the text and, for every chunk, where it starts and ends in it.
// A chunk range includes its overlap, so it is exactly chunk.content.
export function assembleChunks(chunks: ChunkPiece[]): { text: string; ranges: ChunkRange[] } {
  let text = "";
  const ranges: ChunkRange[] = [];

  for (const [i, chunk] of chunks.entries()) {
    let start: number;
    if (i === 0) {
      start = 0;
      text = chunk.content;
    } else {
      const overlap = overlapLength(chunks[i - 1].content, chunk.content);
      if (overlap > 0) {
        // The chunk starts inside the text we already have.
        start = text.length - overlap;
        text += chunk.content.slice(overlap);
      } else {
        start = text.length + NO_OVERLAP_SEPARATOR.length;
        text += NO_OVERLAP_SEPARATOR + chunk.content;
      }
    }
    ranges.push({ id: chunk.id, start, end: start + chunk.content.length });
  }

  return { text, ranges };
}

// What GET /api/sources/[id]/text returns: one page of a source (a PDF
// page, or the whole text of a text or web page source) with the position
// of every chunk in it.
export type SourceText = {
  title: string;
  type: string;
  page: number | null;
  pageCount: number | null;
  text: string;
  ranges: ChunkRange[];
};
