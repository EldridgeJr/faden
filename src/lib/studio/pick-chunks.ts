// Chooses the chunks a studio item (podcast, flashcards) is written from.
//
// The chat searches with the question. A studio item has no question, it
// should cover the selected sources as a whole. So we do not search, we
// spread the chunks evenly over the sources and over each source.

// At most 16 chunks. A chunk has at most about 800 tokens, so the model gets
// at most about 13,000 tokens of source text. That keeps cost and time small.
export const MAX_STUDIO_CHUNKS = 16;

export type ChunkRef = {
  id: number;
  sourceId: string;
  position: number;
};

// sourceIds: the selected sources in display order. Chunks of other sources
// are ignored. Returns the chosen chunks, by source and then by position,
// so they read like the documents.
export function pickChunks<T extends ChunkRef>(
  chunks: T[],
  sourceIds: string[],
  max = MAX_STUDIO_CHUNKS,
): T[] {
  // The chunks of each source, in text order.
  const bySource = sourceIds.map((sourceId) =>
    chunks.filter((chunk) => chunk.sourceId === sourceId).sort((a, b) => a.position - b.position),
  );

  // 1. How many per source: one at a time, source after source (round robin),
  // until max is reached or every source is used up. A small source still gets
  // its share, a big source cannot push out the others.
  const counts = bySource.map(() => 0);
  let total = 0;
  let added = true;
  while (total < max && added) {
    added = false;
    for (let s = 0; s < bySource.length && total < max; s++) {
      if (counts[s] < bySource[s].length) {
        counts[s]++;
        total++;
        added = true;
      }
    }
  }

  // 2. Which ones: k chunks out of n, evenly spaced, from the middle of each
  // of k equal parts. k = 1 takes the middle, k = n takes all.
  return bySource.flatMap((list, s) => {
    const n = list.length;
    const k = counts[s];
    return Array.from({ length: k }, (_, i) => list[Math.floor(((i + 0.5) * n) / k)]);
  });
}
