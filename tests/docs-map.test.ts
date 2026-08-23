/**
 * The map in docs/STATE.md is what a new session reads instead of exploring the
 * codebase, so a stale entry costs exactly what the map exists to save: the
 * session opens a path that no longer exists, then falls back to searching.
 *
 * This asserts every source path the map names is real. It is cheap insurance
 * against the map quietly rotting after a rename.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const state = fs.readFileSync(path.join(ROOT, "docs/STATE.md"), "utf8");

/**
 * Paths as the map writes them: bare `lib/...` and `components/...` are
 * relative to src/, everything else is relative to the repo root.
 */
function resolve(ref: string): string {
  const clean = ref.replace(/[.,)]+$/, "");
  if (clean.startsWith("lib/") || clean.startsWith("components/") || clean.startsWith("app/")) {
    return path.join(ROOT, "src", clean);
  }
  return path.join(ROOT, clean);
}

/**
 * Expand the brace shorthand the map uses to keep related components on one
 * line: `stock/{A,B}.tsx` becomes both paths. Worth supporting rather than
 * banning — a compact map is the entire point, and unchecked shorthand is how
 * a map rots.
 */
function expand(ref: string): string[] {
  const brace = ref.match(/^(.*)\{([^}]+)\}(.*)$/);
  if (!brace) return [ref];
  const [, before, list, after] = brace;
  return list.split(",").map((part) => `${before}${part.trim()}${after}`);
}

/** Every file-looking token in the document, deduplicated. */
function referencedPaths(text: string): string[] {
  const found = new Set<string>();

  // Fenced code blocks: the map itself, one path per line before the prose.
  for (const block of text.match(/```[\s\S]*?```/g) ?? []) {
    for (const line of block.split("\n")) {
      const first = line.trim().split(/\s+/)[0];
      if (/^(lib|components|app)\/\S+\.(ts|tsx|css)$/.test(first)) {
        for (const one of expand(first)) found.add(one);
      }
      if (/^(src|scripts|tests|e2e)\/\S+\.\w+$/.test(first)) {
        for (const one of expand(first)) found.add(one);
      }
      if (/^(middleware\.ts|next\.config\.mjs)$/.test(first)) {
        found.add(first === "middleware.ts" ? "src/middleware.ts" : first);
      }
    }
  }

  // Inline `backticked` paths in the prose and tables.
  for (const m of text.matchAll(/`([^`\s]+\.(?:ts|tsx|css|mjs|md|html))`/g)) {
    const ref = m[1];
    if (ref.includes("/") || ref === "middleware.ts") found.add(ref);
  }

  // `<name>` marks a placeholder in a recipe ("add src/app/api/<name>/route.ts"),
  // not a path that should exist.
  return [...found].filter((ref) => !ref.includes("<"));
}

describe("the STATE.md map points at files that exist", () => {
  const refs = referencedPaths(state);

  it("finds a map worth checking", () => {
    // A map that shrank to nothing would make every assertion below vacuous.
    expect(refs.length).toBeGreaterThan(20);
  });

  it.each(refs)("%s exists", (ref) => {
    expect(fs.existsSync(resolve(ref))).toBe(true);
  });

  it("names the branch the working agreements name", () => {
    const claude = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
    const branch = claude.match(/Branch: `([^`]+)`/)?.[1];
    expect(branch).toBeTruthy();
    expect(state).toContain(branch!);
  });

  it("keeps itself short enough to be read every session", () => {
    // The whole point is a cheap cold start. Past roughly 12k characters it is
    // no longer cheaper than letting a session look around for itself, and the
    // detail belongs in docs/HISTORY.md.
    expect(state.length).toBeLessThan(12_000);
  });
});
