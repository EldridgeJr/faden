// The numbered source blocks in every prompt: chat, podcast, flashcards.
// One place, so the protection against prompt injection is the same everywhere.

// What a prompt needs from a chunk.
export type PromptChunk = {
  sourceTitle: string;
  page: number | null;
  content: string;
};

// Text from sources is data, not instructions. It goes into <quelle> blocks.
// A source must not be able to close its block and write "outside" of it,
// so we break every <quelle or </quelle tag inside the text.
// "‹" looks similar to "<", the model can still read the text.
function neutralizeTags(text: string): string {
  return text.replace(/<(\/?quelle)/gi, "‹$1");
}

// The chunks as blocks numbered [1] to [n], in the given order.
export function formatSourceBlocks(chunks: PromptChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const where = chunk.page === null ? "" : ` · Seite ${chunk.page}`;
      return [
        `<quelle nr="${i + 1}">`,
        `Titel: ${neutralizeTags(chunk.sourceTitle)}${where}`,
        neutralizeTags(chunk.content),
        `</quelle>`,
      ].join("\n");
    })
    .join("\n\n");
}
