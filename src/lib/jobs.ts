import { getDb, getUserById, listGroups, listHoldings, saveDigest } from "./db";
import { computeGroupFacts } from "./digest/engine";
import { writeDigest } from "./digest/writer";
import { scoreStock } from "./insight/score";
import { digestTemplate, sendMail } from "./mailer";
import { effectiveLimits } from "./plans";
import { siteUrl } from "./site";
import { unsubscribeToken } from "./tokens";
import type { DigestPeriod, User } from "./types";

/**
 * Scheduled work: the daily/weekly digest send and alert evaluation.
 *
 * Written as plain functions so they can be driven by a cron route, a queue
 * worker, or a test — nothing here assumes a particular scheduler.
 */

export interface JobReport {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
  reasons: Record<string, number>;
}

function emptyReport(): JobReport {
  return { considered: 0, sent: 0, skipped: 0, failed: 0, reasons: {} };
}

function note(report: JobReport, reason: string): void {
  report.reasons[reason] = (report.reasons[reason] ?? 0) + 1;
}

/** Users eligible for a send, with the gates that protect deliverability. */
function eligibleUsers(): User[] {
  const rows = getDb()
    .prepare("SELECT id FROM users ORDER BY id")
    .all() as { id: number }[];
  return rows
    .map((r) => getUserById(r.id))
    .filter((u): u is User => u !== null);
}

export async function runDigestJob(
  period: DigestPeriod = "daily",
  now: Date = new Date(),
): Promise<JobReport> {
  const report = emptyReport();

  for (const user of eligibleUsers()) {
    report.considered++;

    // Three hard gates, in order of how badly getting them wrong would hurt:
    // never mail an unverified address (spam-trap risk), never mail someone who
    // opted out (legal risk), never mail twice in a day (annoyance).
    if (!user.emailVerifiedAt) {
      report.skipped++; note(report, "email_unverified"); continue;
    }
    if (!user.emailOptIn) {
      report.skipped++; note(report, "opted_out"); continue;
    }
    if (!effectiveLimits(user).emailDelivery) {
      report.skipped++; note(report, "plan_excludes_email"); continue;
    }
    if (
      user.lastDigestSentAt &&
      now.getTime() - new Date(user.lastDigestSentAt).getTime() < 20 * 3600_000
    ) {
      report.skipped++; note(report, "already_sent_today"); continue;
    }

    const groups = listGroups(user.id);
    const withHoldings = groups
      .map((g) => ({ group: g, holdings: listHoldings(g.id) }))
      .filter((g) => g.holdings.length > 0);

    if (withHoldings.length === 0) {
      report.skipped++; note(report, "no_holdings"); continue;
    }

    try {
      // One email per user, covering their largest watchlist — several emails
      // a morning is how a useful product turns into noise.
      const primary = withHoldings.sort((a, b) => b.holdings.length - a.holdings.length)[0];
      const facts = computeGroupFacts(primary.group.name, primary.holdings, now, period);
      const written = await writeDigest(facts, effectiveLimits(user).deepDigest);

      saveDigest(
        primary.group.id, facts.asOf, written.headline, written.body,
        facts, written.writer, period,
      );

      const mail = digestTemplate(
        user.name,
        written.headline,
        written.body,
        `${siteUrl()}/dashboard/groups/${primary.group.id}`,
        `${siteUrl()}/unsubscribe?token=${unsubscribeToken(user.id)}`,
      );
      const result = await sendMail({ ...mail, to: user.email });

      if (result.ok) {
        getDb()
          .prepare("UPDATE users SET last_digest_sent_at = ? WHERE id = ?")
          .run(now.toISOString(), user.id);
        report.sent++;
      } else {
        report.failed++; note(report, `send_failed:${result.error.slice(0, 40)}`);
      }
    } catch (err) {
      report.failed++; note(report, `error:${String(err).slice(0, 60)}`);
    }
  }

  return report;
}

// ---------- alerts ----------

export interface AlertHit {
  userId: number;
  symbol: string;
  score: number;
  direction: "above" | "below";
  threshold: number;
}

/**
 * Fire alerts whose condition is met. A fired alert is suppressed for 24 hours
 * so a score hovering on the threshold cannot spam the user.
 */
export function runAlertJob(now: Date = new Date()): AlertHit[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM alerts").all() as {
    id: number; user_id: number; symbol: string;
    direction: "above" | "below"; threshold: number; last_fired_at: string | null;
  }[];

  const hits: AlertHit[] = [];

  for (const a of rows) {
    if (a.last_fired_at && now.getTime() - new Date(a.last_fired_at).getTime() < 24 * 3600_000) {
      continue;
    }
    const scored = scoreStock(a.symbol, now);
    if (!scored) continue;

    const met =
      a.direction === "above" ? scored.score >= a.threshold : scored.score <= a.threshold;
    if (!met) continue;

    db.prepare("UPDATE alerts SET last_fired_at = ? WHERE id = ?").run(now.toISOString(), a.id);
    db.prepare(
      "INSERT INTO notifications (user_id, kind, title, body, href) VALUES (?, 'alert', ?, ?, ?)",
    ).run(
      a.user_id,
      `${a.symbol} Insight Score is ${a.direction} ${a.threshold}`,
      `${a.symbol} now scores ${scored.score.toFixed(0)} — ${scored.band} signals.`,
      `/dashboard/stocks/${a.symbol}`,
    );

    hits.push({
      userId: a.user_id, symbol: a.symbol, score: scored.score,
      direction: a.direction, threshold: a.threshold,
    });
  }

  return hits;
}

// ---------- market data refresh ----------

export interface RefreshReport {
  provider: string;
  symbols: number;
  quotes: number;
  histories: number;
  newsItems: number;
  failures: { symbol: string; error: string }[];
}

/**
 * Pull vendor data into the cache.
 *
 * Only refreshes symbols someone is actually watching, plus the index trackers
 * used as comparison baselines. Refreshing the whole universe would burn a
 * free-tier quota on symbols nobody has ever opened.
 *
 * Failures are collected rather than thrown: one delisted symbol must not stop
 * the other ninety-nine from refreshing.
 */
export async function refreshMarketData(now: Date = new Date()): Promise<RefreshReport> {
  const report: RefreshReport = {
    provider: process.env.MARKET_DATA_PROVIDER ?? "mock",
    symbols: 0, quotes: 0, histories: 0, newsItems: 0, failures: [],
  };
  if (report.provider === "mock") return report;

  const { finnhubMarketData, finnhubNews } = await import("./providers/finnhub");
  const { cacheCloses, cacheNews, cacheQuote } = await import("./providers/cache");

  const watched = getDb()
    .prepare("SELECT DISTINCT symbol FROM holdings ORDER BY symbol")
    .all() as { symbol: string }[];
  const symbols = [...new Set([...watched.map((r) => r.symbol), "SPY", "QQQ"])];
  report.symbols = symbols.length;

  for (const symbol of symbols) {
    try {
      const quote = await finnhubMarketData.fetchQuote(symbol);
      if (quote) {
        cacheQuote(quote, now);
        report.quotes++;
      }

      const closes = await finnhubMarketData.fetchDailyCloses(symbol, 400);
      if (closes.length > 0) {
        cacheCloses(symbol, closes);
        report.histories++;
      }

      const news = await finnhubNews.fetchNews(
        symbol,
        new Date(now.getTime() - 7 * 86_400_000),
        now,
      );
      if (news.length > 0) {
        cacheNews(symbol, news);
        report.newsItems += news.length;
      }
    } catch (err) {
      report.failures.push({ symbol, error: String(err).slice(0, 120) });
    }
  }

  return report;
}
