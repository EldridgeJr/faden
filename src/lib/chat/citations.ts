import type { UIMessage } from "ai";
import { z } from "zod";

// Used on the server (check and store citations) and in the browser
// (show [1] as a button). So no "server-only" here.

// The exact answer when the sources do not contain the answer.
export const NO_ANSWER = "Dazu habe ich in deinen Quellen nichts gefunden.";

// One numbered chunk the model got as [n]. Stored in messages.citations
// (jsonb) and sent to the browser. The content is copied on purpose: the
// answer stays readable even after its source was deleted.
export const citationSchema = z.object({
  n: z.number().int().min(1),
  chunkId: z.number().int(),
  sourceId: z.uuid(),
  sourceTitle: z.string(),
  page: z.number().int().nullable(),
  position: z.number().int(),
  content: z.string(),
});
export type Citation = z.infer<typeof citationSchema>;

// A chat message as useChat sees it. Besides text, an answer has one data
// part "citations": the numbered chunks the model got for this answer.
export type ChatMessage = UIMessage<never, { citations: Citation[] }>;

// Matches [1], [12] and lists like [1, 2]. The prompt asks for [1][2],
// but models sometimes write [1, 2]. Ranges like [1-3] are not matched.
// No capture group inside: split() below would return it as an extra piece.
const CITATION = String.raw`\[\d+(?:\s*,\s*\d+)*\]`;

// "[1, 2]" → [1, 2]
function numbersIn(bracket: string): number[] {
  return bracket
    .slice(1, -1)
    .split(",")
    .map((part) => Number(part.trim()));
}

// The citation numbers in an answer, sorted and without duplicates.
// Only numbers from 1 to count are kept. The model got exactly count chunks,
// so [9] with 8 chunks points to nothing and is dropped.
export function findCitations(text: string, count: number): number[] {
  const found = new Set<number>();
  for (const [bracket] of text.matchAll(new RegExp(CITATION, "g"))) {
    for (const n of numbersIn(bracket)) {
      if (n >= 1 && n <= count) found.add(n);
    }
  }
  return [...found].sort((a, b) => a - b);
}

export type Segment = { type: "text"; text: string } | { type: "citation"; n: number };

// Splits an answer into text and citations, so React can render [n] as a
// button and everything else as plain text (never as HTML).
// A bracket with an unknown number stays plain text.
export function splitCitations(text: string, validNumbers: ReadonlySet<number>): Segment[] {
  const segments: Segment[] = [];
  let pendingText = "";

  // split() with one capture group keeps the matches:
  // text at even indexes, brackets like "[1, 2]" at odd indexes.
  const pieces = text.split(new RegExp(`(${CITATION})`));
  for (const [i, piece] of pieces.entries()) {
    const numbers = i % 2 === 1 ? numbersIn(piece) : [];
    if (numbers.length > 0 && numbers.every((n) => validNumbers.has(n))) {
      if (pendingText) segments.push({ type: "text", text: pendingText });
      pendingText = "";
      for (const n of numbers) segments.push({ type: "citation", n });
    } else {
      pendingText += piece;
    }
  }
  if (pendingText) segments.push({ type: "text", text: pendingText });
  return segments;
}

// Removes [n] from an old answer. In the history, these numbers would point
// to the chunks of an earlier question, not to the chunks of the new one.
export function stripCitations(text: string): string {
  return text.replace(new RegExp(String.raw`\s?${CITATION}`, "g"), "");
}
