import { describe, expect, it } from "vitest";
import { normalizeText } from "./chunk";
import { extractReadableText, MIN_READABLE_CHARS } from "./readable";

const paragraph = (n: number) =>
  `Absatz ${n}: Das Faden-Haus bietet ruhige Arbeitsplätze, schnelle Leitungen und eine ` +
  `Küche auf jeder Etage. Mitglieder können Besprechungsräume über die App buchen und ` +
  `bekommen jeden Monat ein festes Raumguthaben.`;

const page = `<!doctype html>
<html><head><title>Faden-Haus · Hausordnung</title></head>
<body>
  <nav><a href="/">Start</a> <a href="/preise">Preise</a> <a href="/kontakt">Kontakt</a></nav>
  <article>
    <h1>Hausordnung</h1>
    <p>${paragraph(1)}</p>
    <p>${paragraph(2)}</p>
    <ul><li>Erster Punkt der Liste</li><li>Zweiter Punkt der Liste</li></ul>
    <p>${paragraph(3)}</p>
    <script>alert("nie ausführen")</script>
  </article>
  <footer>© 2026 Faden-Haus · Impressum · Datenschutz</footer>
</body></html>`;

describe("extractReadableText", () => {
  it("finds the title and the main text", () => {
    const { title, text } = extractReadableText(page, "text/html; charset=utf-8");
    expect(title).toBe("Faden-Haus · Hausordnung");
    expect(text).toContain(paragraph(1));
    expect(text).toContain(paragraph(3));
  });

  it("drops navigation, footer and scripts", () => {
    const { text } = extractReadableText(page, "text/html");
    expect(text).not.toContain("Preise");
    expect(text).not.toContain("Impressum");
    expect(text).not.toContain("alert");
  });

  it("keeps paragraphs and list items apart", () => {
    const text = normalizeText(extractReadableText(page, "text/html").text);
    expect(text).toContain(`${paragraph(1)}\n\n${paragraph(2)}`);
    expect(text).toContain("Erster Punkt der Liste\n\nZweiter Punkt der Liste");
  });

  it("returns plain text unchanged", () => {
    expect(extractReadableText("Nur Text.", "text/plain")).toEqual({
      title: null,
      text: "Nur Text.",
    });
  });

  it("returns less than MIN_READABLE_CHARS for a page without an article", () => {
    const { text } = extractReadableText(
      "<html><body><nav>Menü</nav><div id=app></div></body></html>",
      "text/html",
    );
    expect(normalizeText(text).length).toBeLessThan(MIN_READABLE_CHARS);
  });
});
