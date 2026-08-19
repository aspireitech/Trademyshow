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

import { runAlertJob, runDigestJob } from "@/lib/jobs";
import {
  addHolding,
  createGroup,
  createUser,
  getDb,
  markEmailVerified,
  resetDbForTests,
  setEmailOptIn,
  setUserPlan,
} from "@/lib/db";

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
