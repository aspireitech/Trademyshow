/**
 * Wording audit.
 *
 * The product's legal position rests on being a publication rather than an
 * adviser, and that position is made or broken by the words on the screen.
 * A single "we recommend" in a marketing headline undoes a great deal of
 * careful architecture, so the prohibition is enforced by a test rather than
 * by remembering.
 *
 * This checks copy the product ships. It is not legal review.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { writeWithTemplate } from "@/lib/digest/writer";
import { computeGroupFacts } from "@/lib/digest/engine";
import { TERMS_SECTIONS, TERMS_SUMMARY } from "@/lib/legal";
import type { Holding } from "@/lib/types";

/**
 * Phrases that assert advice, certainty, or a predicted outcome. Each one is
 * a sentence a regulator or a plaintiff could quote back.
 */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\bwe recommend\b/i, why: "asserts a recommendation" },
  { pattern: /\bour recommendation\b/i, why: "asserts a recommendation" },
  { pattern: /\bwe advise\b/i, why: "asserts advice" },
  { pattern: /\bour advice\b/i, why: "asserts advice" },
  { pattern: /\byou should (buy|sell|invest|hold)\b/i, why: "directs a transaction" },
  { pattern: /\b(buy|sell) (now|today)\b/i, why: "directs a transaction" },
  { pattern: /\bstrong (buy|sell)\b/i, why: "analyst-rating language" },
  { pattern: /\bprice target\b/i, why: "a forecast of price" },
  { pattern: /\bguarantee(d|s)?\b/i, why: "promises an outcome" },
  { pattern: /\brisk[- ]free\b/i, why: "denies inherent risk" },
  { pattern: /\bsure thing\b/i, why: "promises an outcome" },
  { pattern: /\bwill (rise|fall|climb|drop|outperform|beat)\b/i, why: "predicts price movement" },
  { pattern: /\bbeat the market\b/i, why: "promises relative performance" },
  { pattern: /\bget rich\b/i, why: "promises an outcome" },
  { pattern: /\bdouble your money\b/i, why: "promises an outcome" },
  { pattern: /\bhot stock\b/i, why: "promotional tipping language" },
  { pattern: /\bbest stocks? to buy\b/i, why: "directs a transaction" },
  { pattern: /\bcan'?t lose\b/i, why: "denies inherent risk" },
];

/** Phrases only acceptable when negated, e.g. "not investment advice". */
const NEGATION_REQUIRED = [/investment advice/i, /financial advice/i];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Pull out text a user could actually read: JSX text nodes and prose-looking
 * string literals. Identifiers and single-word strings are skipped — matching
 * those produces noise that trains people to ignore the test.
 */
/** Comments explain the code; they never reach a user. Strip them first. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

/**
 * A forbidden phrase inside a denial is the disclaimer working, not a
 * violation — "not that the price will rise" is exactly the sentence we want.
 * So the check runs per sentence and skips negated ones.
 */
function offendingSentences(text: string, patterns: { pattern: RegExp; why: string }[]) {
  const negated = /\b(not|never|no|none|nothing|neither|cannot|can'?t|does not|doesn'?t|do not|don'?t|without|rather than|instead of)\b/i;
  return text
    .split(/(?<=[.?!])\s+/)
    .flatMap((sentence) =>
      negated.test(sentence)
        ? []
        : patterns.filter((p) => p.pattern.test(sentence)).map((p) => ({ sentence, why: p.why })),
    );
}

function visibleStrings(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/>\s*([^<>{}\n][^<>{}]{6,})\s*</g)) out.push(m[1]);
  for (const m of source.matchAll(/"([^"\\]{12,})"/g)) {
    if (/\s/.test(m[1]) && !m[1].startsWith("@/") && !m[1].includes("://")) out.push(m[1]);
  }
  for (const m of source.matchAll(/`([^`\\$]{12,})`/g)) {
    if (/\s/.test(m[1])) out.push(m[1]);
  }
  return out;
}

const FILES = [
  ...sourceFiles(path.join(process.cwd(), "src", "app")),
  ...sourceFiles(path.join(process.cwd(), "src", "components")),
  ...sourceFiles(path.join(process.cwd(), "src", "lib")),
].filter((f) => !f.includes("legal.ts") && !f.includes("wording"));

describe("shipped copy", () => {
  it("never asserts advice, certainty or a predicted outcome", () => {
    const hits: string[] = [];
    for (const file of FILES) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      for (const raw of visibleStrings(source)) {
        const text = raw.replace(/\s+/g, " ").trim();
        for (const { sentence, why } of offendingSentences(text, FORBIDDEN)) {
          hits.push(`${path.relative(process.cwd(), file)}: "${sentence.slice(0, 90)}" — ${why}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("only ever mentions investment advice to disclaim it", () => {
    const hits: string[] = [];
    for (const file of FILES) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      // JSX wraps prose across lines, so collapse whitespace before matching —
      // otherwise a negation and its object land too far apart to pair up.
      for (const raw of visibleStrings(source)) {
        const text = raw.replace(/\s+/g, " ").trim();
        for (const pattern of NEGATION_REQUIRED) {
          if (!pattern.test(text)) continue;
          const negated =
            /\b(not|never|no|none|nothing|neither|isn'?t|does not|do not|rather than|instead of|without)\b[^.]{0,80}(investment|financial) advice/i.test(
              text,
            ) || /(investment|financial) advice[^.]{0,25}\b(is|are) (not|never)\b/i.test(text);
          if (!negated) {
            hits.push(`${path.relative(process.cwd(), file)}: "${text.slice(0, 90)}"`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("generated insight text", () => {
  const symbols = ["AAPL", "NVDA", "TSLA", "SPY", "BTC-USD", "XOM", "JPM", "AGG"];

  it("never emits forbidden language, across many generated digests", () => {
    // The template writer runs whenever no AI key is configured, so its output
    // ships to real users and needs the same guarantee as hand-written copy.
    const hits: string[] = [];
    for (let day = 0; day < 40; day++) {
      const asOf = new Date(Date.UTC(2026, 0, 1 + day * 7));
      const holdings: Holding[] = symbols.slice(0, 1 + (day % 8)).map((s, i) => ({
        id: i, groupId: 1, symbol: s, quantity: 1 + i, addedAt: "2026-01-01",
      }));
      for (const period of ["daily", "weekly"] as const) {
        const facts = computeGroupFacts("Test list", holdings, asOf, period);
        for (const deep of [false, true]) {
          const written = writeWithTemplate(facts, deep);
          const text = `${written.headline}\n${written.body}`;
          for (const { pattern, why } of FORBIDDEN) {
            if (pattern.test(text)) hits.push(`${asOf.toISOString()} ${period}: ${why}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("closes every digest with the not-advice disclaimer", () => {
    const holdings: Holding[] = [{ id: 1, groupId: 1, symbol: "AAPL", quantity: 5, addedAt: "2026-01-01" }];
    const facts = computeGroupFacts("Test list", holdings, new Date("2026-05-05"), "daily");
    expect(writeWithTemplate(facts, false).body).toMatch(/not investment advice/i);
  });
});

describe("terms text", () => {
  const all = [...TERMS_SUMMARY, ...TERMS_SECTIONS.flatMap((s) => [s.heading, ...s.paragraphs])].join("\n");

  it("carries the clauses the product's position depends on", () => {
    for (const required of [
      /not investment advice|never investment advice|is NOT.*investment adviser/i,
      /no fiduciary/i,
      /total aggregate liability/i,
      /class action waiver/i,
      /binding individual arbitration/i,
      /past performance/i,
      /solely responsible/i,
    ]) {
      expect(all).toMatch(required);
    }
  });

  it("preserves the carve-outs that keep the limits enforceable", () => {
    // A limitation clause that overreaches gets struck entirely, which would
    // leave the business worse off than a modest one that survives.
    expect(all).toMatch(/cannot lawfully be excluded/i);
    expect(all).toMatch(/mandatory|non-excludable|statutory rights/i);
    expect(all).toMatch(/consumer/i);
  });

  it("does not promise the user anything it cannot deliver", () => {
    for (const { pattern } of FORBIDDEN) {
      // "guarantee" is permitted here only in the negative ("we do not guarantee").
      if (/guarantee/.test(pattern.source)) continue;
      expect(all).not.toMatch(pattern);
    }
    expect(all).not.toMatch(/\bwe guarantee\b/i);
  });
});
