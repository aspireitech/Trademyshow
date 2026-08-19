/**
 * Executed-agreement records.
 *
 * A disclaimer only helps if you can show the user accepted it. These tests
 * cover the properties that make the record worth having: it exists for every
 * account, it matches the wording that was displayed, and it is tamper-evident.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

process.env.DB_PATH = ":memory:";
process.env.AUTH_SECRET = "test-secret-for-contract-tests";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tms-contracts-"));
process.env.CONTRACTS_DIR = tmp;

import { getContract, listContracts, readContractPdf, recordAcceptance } from "@/lib/contracts";
import { createUser, getDb, getUserById, resetDbForTests } from "@/lib/db";
import { TERMS_SECTIONS, TERMS_VERSION } from "@/lib/legal";

let user: { id: number; email: string; name: string };

beforeEach(async () => {
  resetDbForTests();
  for (const f of fs.readdirSync(tmp)) fs.rmSync(path.join(tmp, f));
  user = await createUser("signer@example.com", "Ada Signer", "hash");
});

describe("recordAcceptance", () => {
  it("writes a PDF and a database row together", () => {
    const record = recordAcceptance(user)!;
    expect(record.contractId).toMatch(/^TMS-\d{4}-\d{6}-[0-9A-F]{8}$/);
    expect(fs.existsSync(path.join(tmp, record.filename))).toBe(true);
    expect(listContracts(user.id)).toHaveLength(1);
  });

  it("stamps the user's acceptance onto their account", () => {
    recordAcceptance(user);
    const updated = getUserById(user.id)!;
    expect(updated.termsVersion).toBe(TERMS_VERSION);
    expect(updated.termsAcceptedAt).not.toBeNull();
  });

  it("produces a real PDF", () => {
    const record = recordAcceptance(user)!;
    const bytes = fs.readFileSync(path.join(tmp, record.filename));
    expect(bytes.subarray(0, 8).toString()).toMatch(/^%PDF-1\.\d/);
    expect(bytes.subarray(-6).toString().trim()).toBe("%%EOF");
  });

  it("contains the identifying facts a dispute would turn on", () => {
    const record = recordAcceptance(user)!;
    const text = fs.readFileSync(path.join(tmp, record.filename), "latin1");
    expect(text).toContain(record.contractId);
    expect(text).toContain("signer@example.com");
    expect(text).toContain(TERMS_VERSION);
  });

  it("embeds the actual terms, not a reference to them", () => {
    // A record saying "the user accepted our terms" is worth very little if
    // the terms it points at can change afterwards.
    const record = recordAcceptance(user)!;
    const text = fs.readFileSync(path.join(tmp, record.filename), "latin1");
    // The writer transliterates typographic punctuation to Latin-1, so compare
    // on the same footing rather than against the source's curly characters.
    const ascii = (s: string) => s.replace(/[—–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    for (const section of TERMS_SECTIONS.slice(0, 6)) {
      expect(text).toContain(ascii(section.heading));
    }
  });

  it("gives every acceptance a distinct id", () => {
    const a = recordAcceptance(user)!;
    const b = recordAcceptance(user)!;
    expect(a.contractId).not.toBe(b.contractId);
    expect(listContracts(user.id)).toHaveLength(2);
  });

  it("records the fingerprint without storing a raw IP", () => {
    recordAcceptance(user, { ipHash: "abc123hash", userAgent: "Mozilla/5.0 vitest" });
    const row = getDb().prepare("SELECT ip_hash, user_agent FROM contracts").get() as {
      ip_hash: string; user_agent: string;
    };
    expect(row.ip_hash).toBe("abc123hash");
    expect(row.user_agent).toContain("vitest");
  });
});

describe("readContractPdf", () => {
  it("returns the stored file and confirms it is intact", () => {
    const record = recordAcceptance(user)!;
    const read = readContractPdf(user.id, record.contractId)!;
    expect(read.intact).toBe(true);
  });

  it("detects a file altered after it was written", () => {
    // The hash lives in the database, the file on disk. Changing one without
    // the other is exactly what this is meant to reveal.
    const record = recordAcceptance(user)!;
    fs.appendFileSync(path.join(tmp, record.filename), "\n% tampered\n");
    expect(readContractPdf(user.id, record.contractId)!.intact).toBe(false);
  });

  it("will not hand one account's contract to another", async () => {
    const record = recordAcceptance(user)!;
    const other = await createUser("other@example.com", "Other", "hash");
    expect(readContractPdf(other.id, record.contractId)).toBeNull();
    expect(getContract(other.id, record.contractId)).toBeNull();
  });

  it("returns null for an unknown contract id", () => {
    expect(readContractPdf(user.id, "TMS-2026-000001-DEADBEEF")).toBeNull();
  });
});
