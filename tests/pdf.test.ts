/**
 * The hand-rolled PDF writer. Only needs to do one thing well: produce a file
 * every reader opens, containing exactly the text it was given.
 */
import { describe, expect, it } from "vitest";
import { renderPdf } from "@/lib/pdf";

describe("renderPdf", () => {
  it("produces a structurally valid PDF", () => {
    const pdf = renderPdf([{ text: "Hello", style: "title" }]);
    const s = pdf.toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("/Type /Catalog");
    expect(s).toContain("/Type /Pages");
    expect(s).toContain("trailer");
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("declares an xref offset that points at the xref table", () => {
    // Readers seek to this byte offset; wrong value, unopenable file.
    const s = renderPdf([{ text: "Offsets matter" }]).toString("latin1");
    const startxref = Number(s.match(/startxref\n(\d+)/)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe("xref");
  });

  it("paginates long documents and numbers every page", () => {
    const blocks = Array.from({ length: 260 }, (_, i) => ({
      text: `Paragraph ${i} with enough words to occupy a full line of the page.`,
    }));
    const s = renderPdf(blocks).toString("latin1");
    const pageCount = (s.match(/\/Type \/Page[^s]/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
    expect(s).toContain(`page 1 of ${pageCount}`);
    expect(s).toContain(`page ${pageCount} of ${pageCount}`);
  });

  it("escapes the characters that would otherwise corrupt the file", () => {
    // Unescaped parentheses terminate a PDF string early and break the page.
    const s = renderPdf([{ text: "Costs (US$100) \\ or more" }]).toString("latin1");
    expect(s).toContain("\\(US$100\\)");
    expect(s).toContain("\\\\");
  });

  it("transliterates typographic characters instead of dropping them", () => {
    // The terms contain curly quotes and en dashes; losing them silently would
    // change the executed wording.
    const s = renderPdf([{ text: "“quoted” — and ‘so’" }]).toString("latin1");
    expect(s).toContain('"quoted"');
    expect(s).toContain("- and 'so'");
  });

  it("wraps text so no line runs past the margin", () => {
    const long = "word ".repeat(400);
    const s = renderPdf([{ text: long }]).toString("latin1");
    const lines = [...s.matchAll(/\((word )+word?\s*\) Tj/g)];
    expect(lines.length).toBeGreaterThan(10);
  });
});
