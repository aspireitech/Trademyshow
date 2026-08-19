/**
 * A minimal PDF writer for text documents.
 *
 * Written by hand rather than pulled from npm. A signed contract record is
 * exactly the artefact you do not want depending on a transitive package that
 * could change, vanish, or be compromised — and the subset of PDF needed for
 * paginated text in a standard font is small enough to own outright.
 *
 * Produces PDF 1.4 with the base-14 Helvetica family, which every reader has
 * built in, so no font needs embedding.
 */

const PAGE_W = 595.28; // A4 at 72dpi
const PAGE_H = 841.89;
const MARGIN = 56;
const LINE = 13.5;

export interface PdfBlock {
  text: string;
  style?: "title" | "heading" | "body" | "small" | "mono";
}

interface StyleSpec {
  font: "F1" | "F2" | "F3";
  size: number;
  spaceBefore: number;
  leading: number;
}

const STYLES: Record<NonNullable<PdfBlock["style"]>, StyleSpec> = {
  title: { font: "F2", size: 17, spaceBefore: 0, leading: 21 },
  heading: { font: "F2", size: 11, spaceBefore: 12, leading: 15 },
  body: { font: "F1", size: 9.5, spaceBefore: 5, leading: LINE },
  small: { font: "F1", size: 8, spaceBefore: 4, leading: 11 },
  mono: { font: "F3", size: 8.5, spaceBefore: 4, leading: 12 },
};

/**
 * Approximate Helvetica advance widths. Exact metrics would need the AFM
 * tables; this is close enough that no line overflows the margin, which is the
 * only property wrapping actually needs.
 */
function textWidth(s: string, size: number): number {
  let units = 0;
  for (const ch of s) {
    if ("iljI.,:;'|!".includes(ch)) units += 278;
    else if ("frt()[]/\\-".includes(ch)) units += 389;
    else if ("mMW%@".includes(ch)) units += 833;
    else if (ch === " ") units += 278;
    else if (ch >= "A" && ch <= "Z") units += 667;
    else units += 556;
  }
  return (units / 1000) * size;
}

function wrap(text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (textWidth(candidate, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * PDF strings are Latin-1 in this encoding, and the parentheses and backslash
 * that delimit them must be escaped. Characters outside the range are
 * transliterated rather than dropped, so a curly quote in the terms does not
 * silently disappear from the executed contract.
 */
function pdfString(s: string): string {
  const transliterated = s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\xFF]/g, "?");
  return transliterated.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderPdf(blocks: PdfBlock[], footer?: string): Buffer {
  const usable = PAGE_W - MARGIN * 2;
  const pages: string[][] = [];
  let current: string[] = [];
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    if (current.length) pages.push(current);
    current = [];
    y = PAGE_H - MARGIN;
  };

  for (const block of blocks) {
    const spec = STYLES[block.style ?? "body"];
    const lines = wrap(block.text, spec.size, usable);
    y -= spec.spaceBefore;

    for (const line of lines) {
      if (y - spec.leading < MARGIN + 24) newPage();
      y -= spec.leading;
      current.push(
        `BT /${spec.font} ${spec.size} Tf 1 0 0 1 ${MARGIN.toFixed(2)} ${y.toFixed(2)} Tm (${pdfString(line)}) Tj ET`,
      );
    }
  }
  if (current.length) pages.push(current);

  // Page numbers are added last, once the total is known.
  const streams = pages.map((ops, i) => {
    const label = footer
      ? `${footer}  —  page ${i + 1} of ${pages.length}`
      : `page ${i + 1} of ${pages.length}`;
    return [
      ...ops,
      `BT /F1 7 Tf 0.45 0.45 0.45 rg 1 0 0 1 ${MARGIN.toFixed(2)} ${(MARGIN - 16).toFixed(2)} Tm (${pdfString(label)}) Tj ET`,
    ].join("\n");
  });

  return assemble(streams);
}

function assemble(streams: string[]): Buffer {
  const objects: string[] = [];
  const pageCount = streams.length;
  // Object numbering: 1 catalog, 2 pages tree, 3-5 fonts, then per page a
  // page object and a content stream.
  const firstPageObj = 6;
  const kids = streams.map((_, i) => `${firstPageObj + i * 2} 0 R`).join(" ");

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>";

  streams.forEach((stream, i) => {
    const pageObj = firstPageObj + i * 2;
    objects[pageObj] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${pageObj + 1} 0 R >>`;
    objects[pageObj + 1] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(out, "latin1");
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefPos = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return Buffer.from(out, "latin1");
}
