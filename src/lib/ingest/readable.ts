import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

// Elements that start a new paragraph. Their text gets empty lines around it,
// so chunkPages can end chunks at paragraphs.
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt",
  "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "hr", "li", "main", "ol", "p", "pre", "section", "table", "tr", "ul",
]);
const CELL_TAGS = new Set(["td", "th"]);

// Turns the article (a DOM node) into plain text with paragraphs.
function blockText(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? ""; // text node
  if (node.nodeType !== 1) return ""; // comments and the like
  const tag = (node as Element).tagName.toLowerCase();
  const inner = Array.from(node.childNodes).map(blockText).join("");
  if (BLOCK_TAGS.has(tag)) return `\n\n${inner}\n\n`;
  if (CELL_TAGS.has(tag)) return `${inner} `;
  return inner;
}

// Less text than this after cleanup: the page has no real article. Often it
// needs JavaScript (single-page app) or a login. Readability then falls back
// to the whole body and returns menu items or cookie notes.
export const MIN_READABLE_CHARS = 200;

export type ReadableText = { title: string | null; text: string };

// Finds the main text of a web page: no menu, ads or footer.
// Readability is the "reader view" of Firefox. linkedom gives it a DOM on
// the server (lighter than jsdom). Scripts in the page never run.
export function extractReadableText(body: string, contentType: string): ReadableText {
  if (/^text\/plain/i.test(contentType)) {
    return { title: null, text: body };
  }

  const { document } = parseHTML(body);
  const pageTitle = document.title?.trim() || null;
  const article = new Readability(document as unknown as Document, {
    serializer: blockText,
  }).parse();

  return {
    title: article?.title?.trim() || pageTitle,
    text: article?.content ?? "",
  };
}
