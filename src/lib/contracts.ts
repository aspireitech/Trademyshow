import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import {
  LEGAL_CONFIG,
  TERMS_SECTIONS,
  TERMS_SUMMARY,
  TERMS_VERSION,
  PRIVACY_VERSION,
} from "./legal";
import { renderPdf, type PdfBlock } from "./pdf";
import type { User } from "./types";

/**
 * The executed-agreement record.
 *
 * At registration we render the exact terms the user accepted to a PDF, hash
 * it, and store both the file and the hash. Two properties matter:
 *
 *  - The PDF is generated from the same TERMS_SECTIONS the page renders, so
 *    the record cannot show different wording from what was displayed.
 *  - The SHA-256 is stored in the database, separately from the file. If the
 *    stored PDF is ever altered the hash no longer matches, so the record is
 *    tamper-evident rather than merely present.
 *
 * A contract is written once and never rewritten. Later versions of the terms
 * create new records; they do not overwrite history.
 */

export interface ContractRecord {
  contractId: string;
  userId: number;
  termsVersion: string;
  acceptedAt: string;
  sha256: string;
  filename: string;
}

export function contractsDir(): string {
  return process.env.CONTRACTS_DIR ?? path.join(process.cwd(), "data", "contracts");
}

/** `TMS-<year>-<userId>-<random>` — sortable, traceable, not guessable. */
function newContractId(userId: number): string {
  const year = new Date().getUTCFullYear();
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `TMS-${year}-${String(userId).padStart(6, "0")}-${rand}`;
}

function buildBlocks(
  user: Pick<User, "id" | "email" | "name">,
  contractId: string,
  acceptedAt: string,
  ipHash: string | null,
  userAgent: string | null,
): PdfBlock[] {
  const blocks: PdfBlock[] = [
    { text: "TradeMyShow — Terms of Service", style: "title" },
    { text: "Executed agreement record", style: "heading" },
    {
      text:
        `Contract ID: ${contractId}\n` +
        `Account ID: ${user.id}\n` +
        `Accepted by: ${user.name} <${user.email}>\n` +
        `Accepted at: ${acceptedAt} (UTC)\n` +
        `Terms version: ${TERMS_VERSION}\n` +
        `Privacy version: ${PRIVACY_VERSION}\n` +
        `Acceptance method: affirmative checkbox at registration\n` +
        `Origin fingerprint: ${ipHash ?? "not recorded"}\n` +
        `User agent: ${(userAgent ?? "not recorded").slice(0, 120)}`,
      style: "mono",
    },
    {
      text:
        "This document records the acceptance described above. It was generated automatically " +
        "at the moment of acceptance from the same source text displayed to the user, and is " +
        "retained unaltered. Its SHA-256 digest is stored separately so any later modification " +
        "of this file is detectable.",
      style: "small",
    },
    { text: "Summary — the four points that matter most", style: "heading" },
  ];

  for (const line of TERMS_SUMMARY) blocks.push({ text: `• ${line}`, style: "body" });

  blocks.push({ text: "Full terms", style: "heading" });
  for (const section of TERMS_SECTIONS) {
    blocks.push({ text: section.heading, style: "heading" });
    for (const p of section.paragraphs) blocks.push({ text: p, style: "body" });
  }

  blocks.push({ text: "Issued by", style: "heading" });
  blocks.push({
    text:
      `${LEGAL_CONFIG.companyName}\n${LEGAL_CONFIG.address}\n` +
      `Registration number ${LEGAL_CONFIG.companyNumber}\n${LEGAL_CONFIG.contactEmail}`,
    style: "mono",
  });

  return blocks;
}

/**
 * Render, store and record the agreement. Returns the record, or null if the
 * file could not be written — registration must not fail because a disk is
 * full, so the caller treats this as best-effort and the DB row still records
 * that acceptance happened.
 */
export function recordAcceptance(
  user: Pick<User, "id" | "email" | "name">,
  opts: { ipHash?: string | null; userAgent?: string | null; now?: Date } = {},
): ContractRecord | null {
  const acceptedAt = (opts.now ?? new Date()).toISOString();
  const contractId = newContractId(user.id);
  const filename = `${contractId}.pdf`;

  const pdf = renderPdf(
    buildBlocks(user, contractId, acceptedAt, opts.ipHash ?? null, opts.userAgent ?? null),
    `${contractId} · TradeMyShow Terms ${TERMS_VERSION}`,
  );
  const sha256 = crypto.createHash("sha256").update(pdf).digest("hex");

  try {
    const dir = contractsDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), pdf);
  } catch (err) {
    console.error("[contracts] could not write contract PDF:", err);
    return null;
  }

  getDb()
    .prepare(
      "INSERT INTO contracts (contract_id, user_id, terms_version, privacy_version, accepted_at, sha256, filename, ip_hash, user_agent)\n" +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      contractId, user.id, TERMS_VERSION, PRIVACY_VERSION, acceptedAt,
      sha256, filename, opts.ipHash ?? null, (opts.userAgent ?? null)?.slice(0, 300) ?? null,
    );

  getDb()
    .prepare("UPDATE users SET terms_accepted_at = ?, terms_version = ? WHERE id = ?")
    .run(acceptedAt, TERMS_VERSION, user.id);

  return { contractId, userId: user.id, termsVersion: TERMS_VERSION, acceptedAt, sha256, filename };
}

interface ContractRow {
  contract_id: string; user_id: number; terms_version: string;
  accepted_at: string; sha256: string; filename: string;
}

export function listContracts(userId: number): ContractRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM contracts WHERE user_id = ? ORDER BY accepted_at DESC")
    .all(userId) as ContractRow[];
  return rows.map((r) => ({
    contractId: r.contract_id, userId: r.user_id, termsVersion: r.terms_version,
    acceptedAt: r.accepted_at, sha256: r.sha256, filename: r.filename,
  }));
}

export function getContract(userId: number, contractId: string): ContractRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM contracts WHERE user_id = ? AND contract_id = ?")
    .get(userId, contractId) as ContractRow | undefined;
  if (!row) return null;
  return {
    contractId: row.contract_id, userId: row.user_id, termsVersion: row.terms_version,
    acceptedAt: row.accepted_at, sha256: row.sha256, filename: row.filename,
  };
}

/** Read the stored PDF and confirm it still matches the recorded digest. */
export function readContractPdf(
  userId: number,
  contractId: string,
): { pdf: Buffer; intact: boolean } | null {
  const record = getContract(userId, contractId);
  if (!record) return null;
  try {
    const pdf = fs.readFileSync(path.join(contractsDir(), record.filename));
    const digest = crypto.createHash("sha256").update(pdf).digest("hex");
    return { pdf, intact: digest === record.sha256 };
  } catch {
    return null;
  }
}
