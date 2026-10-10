// Import the encoding explicitly. The package default is o200k_base
// (GPT-4o, GPT-5). text-embedding-3-small uses cl100k_base. For German text
// the two differ by up to 50 %, so the wrong one would make chunks too big.
import { countTokens as countCl100k } from "gpt-tokenizer/encoding/cl100k_base";

// No special tokens allowed means: "<|endoftext|>" inside a document is
// counted as plain text. By default the tokenizer throws an error, and a
// crafted PDF could stop the processing.
const asPlainText = { disallowedSpecial: new Set<string>() };

export function countTokens(text: string): number {
  return countCl100k(text, asPlainText);
}
