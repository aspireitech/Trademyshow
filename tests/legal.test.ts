/**
 * The agreement text and its configuration. These assertions encode decisions
 * that were made deliberately, so that changing one is a conscious act.
 */
import { describe, expect, it } from "vitest";

import {
  LEGAL_CONFIG,
  PRIVACY_VERSION,
  TERMS_SECTIONS,
  TERMS_SUMMARY,
  TERMS_VERSION,
  unresolvedLegalPlaceholders,
} from "@/lib/legal";

describe("versioning", () => {
  it("uses a dated, sortable version identifier", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(PRIVACY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});

describe("liability cap", () => {
  it("is capped at the configured ceiling", () => {
    expect(LEGAL_CONFIG.liabilityCapUsd).toBeLessThanOrEqual(1000);
  });

  it("keeps a floor above zero", () => {
    // A cap at or near zero reads as unconscionable and risks the whole clause
    // being struck, which would leave liability uncapped entirely.
    expect(LEGAL_CONFIG.liabilityFloorUsd).toBeGreaterThan(0);
    expect(LEGAL_CONFIG.liabilityFloorUsd).toBeLessThanOrEqual(LEGAL_CONFIG.liabilityCapUsd);
  });

  it("states both the cap and the floor in the text the user reads", () => {
    const clause = TERMS_SECTIONS.find((s) => /Limitation of liability/i.test(s.heading))!;
    const text = clause.paragraphs.join(" ");
    expect(text).toContain(`US$${LEGAL_CONFIG.liabilityCapUsd}`);
    expect(text).toContain(`US$${LEGAL_CONFIG.liabilityFloorUsd}`);
  });
});

describe("structure", () => {
  it("gives every section a heading and at least one paragraph", () => {
    for (const s of TERMS_SECTIONS) {
      expect(s.heading.length).toBeGreaterThan(3);
      expect(s.paragraphs.length).toBeGreaterThan(0);
    }
  });

  it("numbers sections in order, so a clause can be cited unambiguously", () => {
    const numbers = TERMS_SECTIONS.map((s) => Number(s.heading.match(/^(\d+)\./)?.[1]));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it("summarises in plain language without replacing the full text", () => {
    expect(TERMS_SUMMARY.length).toBeGreaterThanOrEqual(3);
    const summaryWords = TERMS_SUMMARY.join(" ").split(/\s+/).length;
    const fullWords = TERMS_SECTIONS.flatMap((s) => s.paragraphs).join(" ").split(/\s+/).length;
    expect(summaryWords).toBeLessThan(fullWords / 5);
  });
});

describe("deployment placeholders", () => {
  it("reports unset values rather than shipping them silently", () => {
    // With nothing configured the defaults are visible placeholders, and the
    // Terms page renders a warning naming each one.
    const missing = unresolvedLegalPlaceholders();
    expect(Array.isArray(missing)).toBe(true);
    if (LEGAL_CONFIG.companyName.startsWith("[")) {
      expect(missing).toContain("companyName");
    }
  });
});
