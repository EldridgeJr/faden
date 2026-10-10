// Builds a small, valid PDF by hand. Only for tests and test fixtures.
//
// Each page is either text (lines separated by "\n") or null. A null page
// has no text, only a grey rectangle: like a scanned page, which is an image.
// Text uses the standard font Helvetica with WinAnsiEncoding, so German
// umlauts work (one byte per character, latin1).

function escapePdfString(line: string): string {
  return line.replace(/[\\()]/g, (c) => "\\" + c);
}

function pageContent(text: string | null): string {
  if (text === null) return "0.6 g 72 72 451 698 re f";
  const lines = text.split("\n").map((line) => `(${escapePdfString(line)}) Tj T*`);
  return ["BT", "/F1 11 Tf", "14 TL", "72 770 Td", ...lines, "ET"].join("\n");
}

export function makePdf(pages: (string | null)[]): Uint8Array {
  // Object numbers: 1 catalog, 2 page tree, 3 font, then per page 2 objects.
  const objects: string[] = [];
  const pageRefs = pages.map((_, i) => `${4 + i * 2} 0 R`);

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`);
  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  pages.forEach((text, i) => {
    const content = pageContent(text);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    );
  });

  // The cross-reference table lists the byte offset of every object.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
