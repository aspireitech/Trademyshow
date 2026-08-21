import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  Alert,
  Digest,
  DigestFacts,
  DigestPeriod,
  DigestWriter,
  Group,
  Holding,
  Notification,
  Plan,
  User,
  UserRole,
  UserSession,
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
      trial_ends_at TEXT,
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
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      code TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      jti TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_jti ON sessions(jti);
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      detail TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      window_start INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      threshold REAL NOT NULL,
      last_fired_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      href TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      percent_off INTEGER NOT NULL,
      max_redemptions INTEGER,
      redemptions INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      commission_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      converted_at TEXT,
      UNIQUE(referred_id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      props TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_name ON events(name, created_at);
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
  // Additive migrations for databases created before these columns existed.
  const userCols = conn.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const addUserCol = (name: string, ddl: string) => {
    if (!userCols.some((c) => c.name === name)) conn.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
  };
  addUserCol("trial_ends_at", "trial_ends_at TEXT");
  addUserCol("email_verified_at", "email_verified_at TEXT");
  addUserCol("totp_secret", "totp_secret TEXT");
  addUserCol("totp_enabled_at", "totp_enabled_at TEXT");
  addUserCol("referral_code", "referral_code TEXT");
  addUserCol("email_opt_in", "email_opt_in INTEGER NOT NULL DEFAULT 1");
  addUserCol("role", "role TEXT NOT NULL DEFAULT 'user'");
  addUserCol("stripe_customer_id", "stripe_customer_id TEXT");
  addUserCol("last_digest_sent_at", "last_digest_sent_at TEXT");
  addUserCol("terms_accepted_at", "terms_accepted_at TEXT");
  addUserCol("terms_version", "terms_version TEXT");
  addUserCol("phone", "phone TEXT");
  addUserCol("phone_verified_at", "phone_verified_at TEXT");
  // A paused subscription keeps the account and its data but stops billing and
  // delivery. Stored as the date it resumes, so "paused" needs no second flag
  // that could disagree with this one.
  addUserCol("paused_until", "paused_until TEXT");

  // Executed agreements. Append-only: a new acceptance adds a row, it never
  // rewrites an old one, so the record of what was agreed and when survives
  // every later change to the terms.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      terms_version TEXT NOT NULL,
      privacy_version TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      filename TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id);
  `);

  // Security questions. Answers are bcrypt hashes, never recoverable text:
  // people reuse answers across sites exactly as they reuse passwords.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS security_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      answer_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS phone_codes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Vendor data, fetched asynchronously and read synchronously. See
  // src/lib/providers/cache.ts for why this layer exists.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS quote_cache (
      symbol TEXT PRIMARY KEY,
      price REAL NOT NULL,
      prev_close REAL NOT NULL,
      change_pct REAL NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS close_cache (
      symbol TEXT NOT NULL,
      day TEXT NOT NULL,
      price REAL NOT NULL,
      PRIMARY KEY (symbol, day)
    );
    CREATE TABLE IF NOT EXISTS news_cache (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      headline TEXT NOT NULL,
      summary TEXT NOT NULL,
      source TEXT NOT NULL,
      url TEXT,
      published_at TEXT NOT NULL,
      sentiment TEXT NOT NULL,
      impact REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_news_cache_symbol ON news_cache(symbol, published_at DESC);

    -- Everything a real feed volunteers beside the last price. Separate from
    -- quote_cache because a quote is refreshed every few minutes while a
    -- 52-week range moves once a day, and because a vendor that supplies only
    -- a price should not have to write nulls over what another one supplied.
    CREATE TABLE IF NOT EXISTS quote_stats_cache (
      symbol TEXT PRIMARY KEY,
      currency TEXT,
      exchange TEXT,
      open REAL,
      day_high REAL,
      day_low REAL,
      volume REAL,
      week52_high REAL,
      week52_low REAL,
      market_cap REAL,
      quote_time TEXT,
      fetched_at TEXT NOT NULL
    );

    -- Instruments discovered through search rather than shipped in the
    -- universe. Someone who looks up a small cap gets a working page, and the
    -- next visitor who types the same letters gets the answer without a round
    -- trip to the vendor.
    CREATE TABLE IF NOT EXISTS symbol_directory (
      symbol TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      asset_class TEXT NOT NULL DEFAULT 'stock',
      source TEXT NOT NULL,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Newsletter subscribers. Kept apart from users: most people who want the
    -- market letter have no account yet, and requiring one to receive it
    -- throws away the cheapest signup path there is.
    -- Today's five-minute bars, as one JSON blob per symbol. A blob rather
    -- than 78 rows because it is always read whole, always replaced whole, and
    -- never queried by time.
    CREATE TABLE IF NOT EXISTS intraday_cache (
      symbol TEXT PRIMARY KEY,
      day TEXT NOT NULL,
      points TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      source TEXT,
      confirmed_at TEXT,
      unsubscribed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Visitor counts. The identifier is a daily salted hash, so it counts
  // returning visitors within a day but cannot be linked across days.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS visitors (
      visitor_id TEXT NOT NULL,
      day TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 1,
      last_path TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (visitor_id, day)
    );
    CREATE INDEX IF NOT EXISTS idx_visitors_day ON visitors(day);
  `);
  // Alerts began as score thresholds only. A price alert is what people
  // actually ask for first, so the row now says which kind it is; existing
  // rows are score alerts, which is what they were.
  const alertCols = conn.prepare("PRAGMA table_info(alerts)").all() as { name: string }[];
  if (!alertCols.some((c) => c.name === "kind")) {
    conn.exec("ALTER TABLE alerts ADD COLUMN kind TEXT NOT NULL DEFAULT 'score'");
  }

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
  role: UserRole;
  trial_ends_at: string | null;
  email_verified_at: string | null;
  totp_secret: string | null;
  totp_enabled_at: string | null;
  referral_code: string | null;
  email_opt_in: number;
  stripe_customer_id: string | null;
  last_digest_sent_at: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  paused_until: string | null;
  created_at: string;
}

function toUser(r: UserRow): User {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    plan: r.plan,
    role: r.role ?? "user",
    trialEndsAt: r.trial_ends_at,
    emailVerifiedAt: r.email_verified_at,
    totpEnabledAt: r.totp_enabled_at,
    referralCode: r.referral_code,
    emailOptIn: r.email_opt_in !== 0,
    stripeCustomerId: r.stripe_customer_id,
    lastDigestSentAt: r.last_digest_sent_at,
    termsAcceptedAt: r.terms_accepted_at ?? null,
    termsVersion: r.terms_version ?? null,
    phone: r.phone ?? null,
    phoneVerifiedAt: r.phone_verified_at ?? null,
    pausedUntil: r.paused_until ?? null,
    createdAt: r.created_at,
  };
}

export function createUser(
  email: string,
  name: string,
  passwordHash: string,
  trialEndsAt: string | null = null,
): User {
  const info = getDb()
    .prepare("INSERT INTO users (email, name, password_hash, trial_ends_at) VALUES (?, ?, ?, ?)")
    .run(email.toLowerCase(), name, passwordHash, trialEndsAt);
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

// ---------- security: sessions, verification, TOTP ----------

export function recordSession(
  userId: number,
  jti: string,
  userAgent: string | null,
  ipHash: string | null,
): void {
  getDb()
    .prepare("INSERT INTO sessions (user_id, jti, user_agent, ip_hash) VALUES (?, ?, ?, ?)")
    .run(userId, jti, userAgent, ipHash);
}

/** A revoked or unknown jti must fail closed — that is what makes logout real. */
export function isSessionActive(jti: string): boolean {
  const r = getDb().prepare("SELECT revoked_at FROM sessions WHERE jti = ?").get(jti) as
    | { revoked_at: string | null }
    | undefined;
  return Boolean(r) && r!.revoked_at === null;
}

export function touchSession(jti: string): void {
  getDb().prepare("UPDATE sessions SET last_seen_at = datetime('now') WHERE jti = ?").run(jti);
}

export function revokeSession(userId: number, jti: string): boolean {
  return (
    getDb()
      .prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND jti = ? AND revoked_at IS NULL")
      .run(userId, jti).changes > 0
  );
}

export function revokeAllSessions(userId: number, exceptJti?: string): number {
  const sql = exceptJti
    ? "UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL AND jti != ?"
    : "UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL";
  const stmt = getDb().prepare(sql);
  return exceptJti ? stmt.run(userId, exceptJti).changes : stmt.run(userId).changes;
}

export function listSessions(userId: number, currentJti: string | null): UserSession[] {
  const rows = getDb()
    .prepare("SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_seen_at DESC")
    .all(userId) as {
    id: number; jti: string; user_agent: string | null;
    created_at: string; last_seen_at: string; revoked_at: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    jti: r.jti,
    userAgent: r.user_agent,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    revokedAt: r.revoked_at,
    current: r.jti === currentJti,
  }));
}

export function markEmailVerified(userId: number): void {
  getDb().prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(userId);
}

export function setPasswordHash(userId: number, hash: string): void {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
}

export function setTotpSecret(userId: number, secret: string | null): void {
  getDb().prepare("UPDATE users SET totp_secret = ? WHERE id = ?").run(secret, userId);
}

export function getTotpSecret(userId: number): string | null {
  const r = getDb().prepare("SELECT totp_secret FROM users WHERE id = ?").get(userId) as
    | { totp_secret: string | null }
    | undefined;
  return r?.totp_secret ?? null;
}

export function setTotpEnabled(userId: number, enabled: boolean): void {
  getDb()
    .prepare(`UPDATE users SET totp_enabled_at = ${enabled ? "datetime('now')" : "NULL"} WHERE id = ?`)
    .run(userId);
}

export function setEmailOptIn(userId: number, optIn: boolean): void {
  getDb().prepare("UPDATE users SET email_opt_in = ? WHERE id = ?").run(optIn ? 1 : 0, userId);
}

export function setReferralCode(userId: number, code: string): void {
  getDb().prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(code, userId);
}

export function getUserByReferralCode(code: string): User | null {
  const r = getDb().prepare("SELECT * FROM users WHERE referral_code = ?").get(code) as
    | UserRow
    | undefined;
  return r ? toUser(r) : null;
}

/**
 * Hard delete. ON DELETE CASCADE removes watchlists, holdings, digests, tokens,
 * sessions, alerts and notifications; audit rows keep their timestamps with a
 * null user, which is what a deletion record is for.
 */
export function deleteUser(userId: number): void {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
}

/** Everything held about one account, for the GDPR export. */
export function exportUserData(userId: number): Record<string, unknown> {
  const db = getDb();
  const one = (sql: string) => db.prepare(sql).all(userId);
  return {
    exportedAt: new Date().toISOString(),
    account: getUserById(userId),
    watchlists: one("SELECT * FROM groups WHERE user_id = ?"),
    holdings: db
      .prepare("SELECT h.* FROM holdings h JOIN groups g ON g.id = h.group_id WHERE g.user_id = ?")
      .all(userId),
    insights: db
      .prepare("SELECT d.* FROM digests d JOIN groups g ON g.id = d.group_id WHERE g.user_id = ?")
      .all(userId),
    alerts: one("SELECT * FROM alerts WHERE user_id = ?"),
    notifications: one("SELECT * FROM notifications WHERE user_id = ?"),
    sessions: one("SELECT id, user_agent, created_at, last_seen_at, revoked_at FROM sessions WHERE user_id = ?"),
    auditLog: one("SELECT id, action, detail, created_at FROM audit_log WHERE user_id = ?"),
    // The executed agreements, so an export answers "what did I agree to, and
    // when" without the user having to ask us.
    contracts: one(
      "SELECT contract_id, terms_version, privacy_version, accepted_at, sha256 FROM contracts WHERE user_id = ?",
    ),
  };
}
