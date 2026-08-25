/**
 * Scheduled work. The gates in the digest job are the tests that matter most:
 * mailing an unverified or opted-out address is the kind of mistake that gets
 * a sending domain blacklisted, and no amount of later care undoes it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DB_PATH = ":memory:";
process.env.AUTH_SECRET = "test-secret-for-job-tests";
delete process.env.ANTHROPIC_API_KEY; // deterministic template writer
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_URL;

const sent: { to: string; subject: string; html: string }[] = [];
vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();
  return {
    ...actual,
    sendMail: async (mail: { to: string; subject: string; html: string }) => {
      sent.push(mail);
      return { ok: true as const, via: "test" };
    },
  };
});

import { runAlertJob, runDigestJob, runTrialNudgeJob, TRIAL_NUDGE_PROMO_CODE } from "@/lib/jobs";
import {
  addHolding,
  createGroup,
  createUser,
  getDb,
  getUserById,
  markEmailVerified,
  resetDbForTests,
  setEmailOptIn,
  setUserPlan,
} from "@/lib/db";
import { getQuote } from "@/lib/marketdata";
import { checkPromo } from "@/lib/billing";

async function subscriber(email = "reader@example.com") {
  const user = await createUser(email, "Reader", "hash");
  markEmailVerified(user.id);
  setEmailOptIn(user.id, true);
  setUserPlan(user.id, "pro");
  const group = createGroup(user.id, "Core");
  addHolding(group.id, "AAPL", 10);
  return { user, group };
}

beforeEach(() => {
  resetDbForTests();
  sent.length = 0;
});

describe("runDigestJob", () => {
  it("sends one email to an eligible subscriber", async () => {
    await subscriber();
    const report = await runDigestJob("daily");
    expect(report.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("reader@example.com");
  });

  it("never mails an unverified address", async () => {
    const { user } = await subscriber();
    getDb().prepare("UPDATE users SET email_verified_at = NULL WHERE id = ?").run(user.id);

    const report = await runDigestJob("daily");
    expect(sent).toHaveLength(0);
    expect(report.reasons.email_unverified).toBe(1);
  });

  it("never mails someone who opted out", async () => {
    const { user } = await subscriber();
    setEmailOptIn(user.id, false);

    const report = await runDigestJob("daily");
    expect(sent).toHaveLength(0);
    expect(report.reasons.opted_out).toBe(1);
  });

  it("does not mail twice in the same day", async () => {
    await subscriber();
    await runDigestJob("daily");
    const second = await runDigestJob("daily");

    expect(sent).toHaveLength(1);
    expect(second.reasons.already_sent_today).toBe(1);
  });

  it("mails again the next day", async () => {
    await subscriber();
    const day1 = new Date("2026-03-02T07:00:00Z");
    await runDigestJob("daily", day1);
    await runDigestJob("daily", new Date(day1.getTime() + 24 * 3600_000));
    expect(sent).toHaveLength(2);
  });

  it("skips an account with no holdings rather than sending an empty digest", async () => {
    const user = await createUser("empty@example.com", "Empty", "hash");
    markEmailVerified(user.id);
    setEmailOptIn(user.id, true);
    setUserPlan(user.id, "pro");
    createGroup(user.id, "Someday");

    const report = await runDigestJob("daily");
    expect(sent).toHaveLength(0);
    expect(report.reasons.no_holdings).toBe(1);
  });

  it("includes a working unsubscribe link in every email", async () => {
    // Required by RFC 8058 in practice, and by every inbox provider's
    // reputation system whether or not you read the RFC.
    await subscriber();
    await runDigestJob("daily");
    expect(sent[0].html).toContain("/unsubscribe?token=");
  });

  it("persists the digest so the site shows the same text as the email", async () => {
    const { group } = await subscriber();
    await runDigestJob("daily");
    const row = getDb()
      .prepare("SELECT COUNT(*) AS n FROM digests WHERE group_id = ?")
      .get(group.id) as { n: number };
    expect(row.n).toBe(1);
  });

  it("counts everyone it looked at, including those it skipped", async () => {
    await subscriber("a@example.com");
    await createUser("b@example.com", "Unverified", "hash");
    const report = await runDigestJob("daily");
    expect(report.considered).toBe(2);
    expect(report.sent + report.skipped + report.failed).toBe(2);
  });
});

describe("runAlertJob", () => {
  async function alertFor(direction: "above" | "below", threshold: number) {
    const user = await createUser("alerts@example.com", "Alerts", "hash");
    getDb()
      .prepare("INSERT INTO alerts (user_id, symbol, direction, threshold) VALUES (?, 'AAPL', ?, ?)")
      .run(user.id, direction, threshold);
    return user;
  }

  it("fires an alert whose condition is met", async () => {
    await alertFor("above", 0); // any score clears zero
    expect(runAlertJob()).toHaveLength(1);
  });

  it("leaves an unmet condition alone", async () => {
    await alertFor("above", 101); // no score can reach this
    expect(runAlertJob()).toHaveLength(0);
  });

  it("suppresses a repeat within 24 hours", async () => {
    await alertFor("above", 0);
    const t0 = new Date("2026-03-02T09:00:00Z");
    expect(runAlertJob(t0)).toHaveLength(1);
    // A score sitting on the threshold would otherwise notify on every run.
    expect(runAlertJob(new Date(t0.getTime() + 3600_000))).toHaveLength(0);
  });

  it("fires again after the suppression window", async () => {
    await alertFor("above", 0);
    const t0 = new Date("2026-03-02T09:00:00Z");
    runAlertJob(t0);
    expect(runAlertJob(new Date(t0.getTime() + 25 * 3600_000))).toHaveLength(1);
  });

  it("leaves a notification the user can read in the app", async () => {
    const user = await alertFor("above", 0);
    runAlertJob();
    const row = getDb()
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?")
      .get(user.id) as { n: number };
    expect(row.n).toBe(1);
  });
});

describe("runAlertJob — daily-move (limit) alerts", () => {
  let n = 0;
  async function changeAlertFor(direction: "above" | "below", threshold: number) {
    const user = await createUser(`moves${n++}@example.com`, "Moves", "hash");
    getDb()
      .prepare("INSERT INTO alerts (user_id, symbol, kind, direction, threshold) VALUES (?, 'AAPL', 'change', ?, ?)")
      .run(user.id, direction, threshold);
    return user;
  }

  it("fires when today's signed move passes the threshold on the alert's own side", async () => {
    const changePct = getQuote("AAPL").changePct;
    const direction = changePct >= 0 ? "above" : "below";
    await changeAlertFor(direction, Math.abs(changePct));
    expect(runAlertJob()).toHaveLength(1);
  });

  it("never fires for a move nowhere near the threshold", async () => {
    await changeAlertFor("above", 99);
    await changeAlertFor("below", 99);
    expect(runAlertJob()).toHaveLength(0);
  });

  it("does not fire a 'below' alert on an up day just because the number is smaller", async () => {
    // The bug this guards against: comparing the raw threshold instead of its
    // negative would let a modest "down 5%" alert fire on a +0.5% day.
    const changePct = getQuote("AAPL").changePct;
    if (changePct < 0) return; // only meaningful on an up day for this symbol/date
    await changeAlertFor("below", 5);
    expect(runAlertJob()).toHaveLength(0);
  });
});

describe("runTrialNudgeJob", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  async function trialingUser(daysLeft: number, email = "trial@example.com") {
    const trialEndsAt = new Date(now.getTime() + daysLeft * 24 * 3600_000).toISOString();
    const user = await createUser(email, "Trialing", "hash", trialEndsAt);
    markEmailVerified(user.id);
    setEmailOptIn(user.id, true);
    return user;
  }

  it("emails a trialing user whose trial ends within the window", async () => {
    const user = await trialingUser(2);
    const report = await runTrialNudgeJob(now);
    expect(report.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(user.email);
    expect(sent[0].subject).toContain("2 days");

    const updated = getUserById(user.id)!;
    expect(updated.trialNudgeSentAt).toBe(now.toISOString());
  });

  it("creates a redeemable promo code the email can reference", async () => {
    await trialingUser(1);
    await runTrialNudgeJob(now);
    expect(checkPromo(TRIAL_NUDGE_PROMO_CODE, now)).toMatchObject({ valid: true, percentOff: 20 });
  });

  it("does not email someone whose trial still has plenty of time left", async () => {
    await trialingUser(10);
    const report = await runTrialNudgeJob(now);
    expect(report.sent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("does not email a non-trialing (plan already resolved) user", async () => {
    const free = await createUser("free@example.com", "Free", "hash"); // no trial set
    markEmailVerified(free.id);
    setEmailOptIn(free.id, true);
    await runTrialNudgeJob(now);
    expect(sent).toHaveLength(0);
  });

  it("never sends the nudge twice, even across separate runs", async () => {
    await trialingUser(1);
    await runTrialNudgeJob(now);
    expect(sent).toHaveLength(1);
    await runTrialNudgeJob(new Date(now.getTime() + 24 * 3600_000));
    expect(sent).toHaveLength(1);
  });

  it("skips an unverified or opted-out address, same gate as the digest", async () => {
    const a = await createUser("unverified@example.com", "A", "hash", new Date(now.getTime() + 24 * 3600_000).toISOString());
    setEmailOptIn(a.id, true); // verified is still false

    const b = await trialingUser(1, "declined@example.com");
    setEmailOptIn(b.id, false);

    await runTrialNudgeJob(now);
    expect(sent).toHaveLength(0);
  });
});
