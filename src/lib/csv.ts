"use client";

/** RFC 4180 quoting: only when the cell needs it, never blanket-wrapped. */
function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

/**
 * Builds the file client-side from data already on screen — there is
 * nothing here a server round trip would add, and it works offline.
 */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
