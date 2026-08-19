import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  Digest,
  DigestFacts,
  DigestPeriod,
  DigestWriter,
  Group,
  Holding,
  Plan,
  User,
} from "./types";

let db: Database.Database | null = null;

function open(): Database.Database {
  const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data", "trademyshow.db");
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const conn = new Database(dbPath);
  conn.pragma("journal_mode = WAL");
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(group_id, symbol)
    );
    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      as_of TEXT NOT NULL,
      headline TEXT NOT NULL,
      body TEXT NOT NULL,
      facts_json TEXT NOT NULL,
      writer TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT 'daily',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Additive migration for databases created before digests carried a period.
  const cols = conn.prepare("PRAGMA table_info(digests)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "period")) {
    conn.exec("ALTER TABLE digests ADD COLUMN period TEXT NOT NULL DEFAULT 'daily'");
  }
  return conn;
}

export function getDb(): Database.Database {
  if (!db) db = open();
  return db;
}

/** Test hook: close and reset so a fresh DB_PATH takes effect. */
export function resetDbForTests(): void {
  db?.close();
  db = null;
}

// ---------- users ----------

interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  plan: Plan;
  created_at: string;
}

function toUser(r: UserRow): User {
  return { id: r.id, email: r.email, name: r.name, plan: r.plan, createdAt: r.created_at };
}

export function createUser(email: string, name: string, passwordHash: string): User {
  const info = getDb()
    .prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)")
    .run(email.toLowerCase(), name, passwordHash);
  return getUserById(Number(info.lastInsertRowid))!;
}

export function getUserById(id: number): User | null {
  const r = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return r ? toUser(r) : null;
}

export function getUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const r = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as
    | UserRow
    | undefined;
  return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
}

export function setUserPlan(id: number, plan: Plan): void {
  getDb().prepare("UPDATE users SET plan = ? WHERE id = ?").run(plan, id);
}

// ---------- groups ----------

interface GroupRow {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

function toGroup(r: GroupRow): Group {
  return { id: r.id, userId: r.user_id, name: r.name, createdAt: r.created_at };
}

export function createGroup(userId: number, name: string): Group {
  const info = getDb().prepare("INSERT INTO groups (user_id, name) VALUES (?, ?)").run(userId, name);
  const r = getDb().prepare("SELECT * FROM groups WHERE id = ?").get(Number(info.lastInsertRowid)) as GroupRow;
  return toGroup(r);
}

export function listGroups(userId: number): Group[] {
  const rows = getDb().prepare("SELECT * FROM groups WHERE user_id = ? ORDER BY id").all(userId) as GroupRow[];
  return rows.map(toGroup);
}

export function getGroup(id: number, userId: number): Group | null {
  const r = getDb().prepare("SELECT * FROM groups WHERE id = ? AND user_id = ?").get(id, userId) as
    | GroupRow
    | undefined;
  return r ? toGroup(r) : null;
}

export function deleteGroup(id: number, userId: number): boolean {
  return getDb().prepare("DELETE FROM groups WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

// ---------- holdings ----------

interface HoldingRow {
  id: number;
  group_id: number;
  symbol: string;
  quantity: number;
  added_at: string;
}

function toHolding(r: HoldingRow): Holding {
  return { id: r.id, groupId: r.group_id, symbol: r.symbol, quantity: r.quantity, addedAt: r.added_at };
}

export function addHolding(groupId: number, symbol: string, quantity: number): Holding {
  const info = getDb()
    .prepare("INSERT INTO holdings (group_id, symbol, quantity) VALUES (?, ?, ?)")
    .run(groupId, symbol.toUpperCase(), quantity);
  const r = getDb().prepare("SELECT * FROM holdings WHERE id = ?").get(Number(info.lastInsertRowid)) as HoldingRow;
  return toHolding(r);
}

export function listHoldings(groupId: number): Holding[] {
  const rows = getDb().prepare("SELECT * FROM holdings WHERE group_id = ? ORDER BY id").all(groupId) as HoldingRow[];
  return rows.map(toHolding);
}

export function removeHolding(groupId: number, symbol: string): boolean {
  return (
    getDb()
      .prepare("DELETE FROM holdings WHERE group_id = ? AND symbol = ?")
      .run(groupId, symbol.toUpperCase()).changes > 0
  );
}

// ---------- digests ----------

interface DigestRow {
  id: number;
  group_id: number;
  as_of: string;
  headline: string;
  body: string;
  facts_json: string;
  writer: DigestWriter;
  period: DigestPeriod;
  created_at: string;
}

function toDigest(r: DigestRow): Digest {
  return {
    id: r.id,
    groupId: r.group_id,
    asOf: r.as_of,
    headline: r.headline,
    body: r.body,
    facts: JSON.parse(r.facts_json) as DigestFacts,
    writer: r.writer,
    period: r.period,
    createdAt: r.created_at,
  };
}

export function saveDigest(
  groupId: number,
  asOf: string,
  headline: string,
  body: string,
  facts: DigestFacts,
  writer: DigestWriter,
  period: DigestPeriod = "daily",
): Digest {
  const info = getDb()
    .prepare(
      "INSERT INTO digests (group_id, as_of, headline, body, facts_json, writer, period) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(groupId, asOf, headline, body, JSON.stringify(facts), writer, period);
  const r = getDb().prepare("SELECT * FROM digests WHERE id = ?").get(Number(info.lastInsertRowid)) as DigestRow;
  return toDigest(r);
}

export function latestDigest(groupId: number, period: DigestPeriod = "daily"): Digest | null {
  const r = getDb()
    .prepare("SELECT * FROM digests WHERE group_id = ? AND period = ? ORDER BY id DESC LIMIT 1")
    .get(groupId, period) as DigestRow | undefined;
  return r ? toDigest(r) : null;
}
