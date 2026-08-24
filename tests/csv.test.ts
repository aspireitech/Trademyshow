import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("joins rows and columns with CRLF and commas", () => {
    expect(toCsv([["Symbol", "Price"], ["AAPL", 208.02]])).toBe("Symbol,Price\r\nAAPL,208.02");
  });

  it("quotes a cell containing a comma, quote, or newline", () => {
    expect(toCsv([["Apple, Inc."]])).toBe('"Apple, Inc."');
    expect(toCsv([['Say "hi"']])).toBe('"Say ""hi"""');
    expect(toCsv([["line1\nline2"]])).toBe('"line1\nline2"');
  });

  it("leaves an ordinary cell unquoted", () => {
    expect(toCsv([["AAPL"]])).toBe("AAPL");
  });
});
