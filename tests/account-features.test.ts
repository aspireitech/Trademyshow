/**
 * Security questions, SMS codes, subscription pausing and the activity feed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DB_PATH = ":memory:";
process.env.AUTH_SECRET = "test-secret-account-features";

import {
  answeredQuestions, hasAnswers, QUESTION_BANK, REQUIRED_ANSWERS,
  saveAnswers, verifyAnswers,
} from "@/lib/securityQuestions";
import { issuePhoneCode, maskPhone, validPhone, verifyPhoneCode } from "@/lib/sms";
import { pauseSubscription, resumeSubscription, subscriptionState, nextPlanUp, isDowngrade } from "@/lib/billing";
import { userActivity } from "@/lib/activity";
import { audit } from "@/lib/security";
import { createUser, getUserById, resetDbForTests } from "@/lib/db";

let userId: number;
beforeEach(async () => {
  resetDbForTests();
  process.env.SANDBOX = "true";
  userId = (await createUser("holder@example.com", "Holder", "hash")).id;
});

// ---------- security questions ----------

const THREE = [
  { questionId: QUESTION_BANK[0].id, answer: "Acme Corporation" },
  { questionId: QUESTION_BANK[1].id, answer: "Maple Street" },
  { questionId: QUESTION_BANK[2].id, answer: "Radiohead 2004" },
];

describe("security questions", () => {
  it("stores answers and reports which questions are set", async () => {
    expect((await saveAnswers(userId, THREE)).ok).toBe(true);
    expect(hasAnswers(userId)).toBe(true);
    expect(answeredQuestions(userId)).toHaveLength(3);
  });

  it("never stores the answer in readable form", async () => {
    await saveAnswers(userId, THREE);
    const { getDb } = await import("@/lib/db");
    const rows = getDb().prepare("SELECT answer_hash FROM security_answers").all() as { answer_hash: string }[];
    for (const r of rows) {
      expect(r.answer_hash.toLowerCase()).not.toContain("acme");
      expect(r.answer_hash.startsWith("$2")).toBe(true);
    }
  });

  it("ignores case, spacing and punctuation when checking", async () => {
    // A question the user cannot answer twice the same way is worse than none.
    await saveAnswers(userId, THREE);
    expect(await verifyAnswers(userId, [
      { questionId: QUESTION_BANK[0].id, answer: "  acme   corporation " },
      { questionId: QUESTION_BANK[1].id, answer: "Maple St.reet" },
      { questionId: QUESTION_BANK[2].id, answer: "radiohead 2004" },
    ])).toBe(true);
  });

  it("requires every answer, not a majority", async () => {
    await saveAnswers(userId, THREE);
    expect(await verifyAnswers(userId, [
      ...THREE.slice(0, 2),
      { questionId: QUESTION_BANK[2].id, answer: "wrong" },
    ])).toBe(false);
  });

  it("refuses fewer than the required number", async () => {
    const r = await saveAnswers(userId, THREE.slice(0, 2));
    expect(r.ok).toBe(false);
    expect(r.error).toContain(String(REQUIRED_ANSWERS));
  });

  it("refuses the same question twice and unknown questions", async () => {
    expect((await saveAnswers(userId, [THREE[0], THREE[0], THREE[1]])).ok).toBe(false);
    expect((await saveAnswers(userId, [
      { questionId: "not_a_question", answer: "x" }, ...THREE.slice(1),
    ])).ok).toBe(false);
  });

  it("refuses answers too short to be a secret", async () => {
    expect((await saveAnswers(userId, [
      { questionId: QUESTION_BANK[0].id, answer: "ab" }, ...THREE.slice(1),
    ])).ok).toBe(false);
  });

  it("replaces the whole set rather than accumulating", async () => {
    await saveAnswers(userId, THREE);
    await saveAnswers(userId, [
      { questionId: QUESTION_BANK[3].id, answer: "Alice" },
      { questionId: QUESTION_BANK[4].id, answer: "Buster" },
      { questionId: QUESTION_BANK[5].id, answer: "Green Lane Vets" },
    ]);
    expect(answeredQuestions(userId)).toHaveLength(3);
    expect(await verifyAnswers(userId, THREE)).toBe(false);
  });
});

// ---------- phone ----------

describe("phone verification", () => {
  it("accepts only E.164 numbers", () => {
    expect(validPhone("+14155550123")).toBe(true);
    expect(validPhone("+1 415 555 0123")).toBe(true);
    expect(validPhone("4155550123")).toBe(false);
    expect(validPhone("+0123")).toBe(false);
  });

  it("masks all but the last two digits", () => {
    const masked = maskPhone("+14155550123");
    expect(masked.endsWith("23")).toBe(true);
    expect(masked).not.toContain("5550");
  });

  it("issues a code and verifies it", async () => {
    const issued = await issuePhoneCode(userId, "+14155550123");
    expect(issued.ok).toBe(true);
    const result = verifyPhoneCode(userId, issued.devCode!);
    expect(result.ok).toBe(true);
    expect(getUserById(userId)!.phoneVerifiedAt).not.toBeNull();
  });

  it("rejects a wrong code and destroys the grant after repeated failures", async () => {
    await issuePhoneCode(userId, "+14155550123");
    for (let i = 0; i < 5; i++) {
      expect(verifyPhoneCode(userId, "000000").ok).toBe(false);
    }
    // Six digits fall to a script quickly; the grant dies rather than the
    // attacker running out of guesses.
    expect(verifyPhoneCode(userId, "000000").error).toMatch(/Request a code first/);
  });

  it("expires the code", async () => {
    const issued = await issuePhoneCode(userId, "+14155550123");
    const later = new Date(Date.now() + 20 * 60_000);
    expect(verifyPhoneCode(userId, issued.devCode!, later).ok).toBe(false);
  });

  it("rejects a badly formatted number before sending anything", async () => {
    const r = await issuePhoneCode(userId, "555-0123");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/international format/i);
  });
});

// ---------- subscription ----------

describe("subscription pause", () => {
  const paidUser = () => ({ plan: "pro" as const, pausedUntil: null });

  it("reports an unpaused account as active", () => {
    expect(subscriptionState(paidUser()).paused).toBe(false);
  });

  it("pauses and resumes", () => {
    const r = pauseSubscription(userId, 30);
    expect(r.ok).toBe(true);
    const user = getUserById(userId)!;
    expect(subscriptionState(user).paused).toBe(true);
    expect(subscriptionState(user).daysRemaining).toBeGreaterThan(28);

    resumeSubscription(userId);
    expect(subscriptionState(getUserById(userId)!).paused).toBe(false);
  });

  it("treats an elapsed pause as active without needing a job to clear it", () => {
    // Storing the resume date rather than a boolean means nothing has to run
    // on time for the subscription to come back.
    pauseSubscription(userId, 7);
    const user = getUserById(userId)!;
    const after = new Date(Date.now() + 8 * 86_400_000);
    expect(subscriptionState(user, after).paused).toBe(false);
  });

  it("enforces sensible bounds", () => {
    expect(pauseSubscription(userId, 1).ok).toBe(false);
    expect(pauseSubscription(userId, 400).ok).toBe(false);
    expect(pauseSubscription(userId, Number.NaN).ok).toBe(false);
  });
});

describe("plan ordering", () => {
  it("knows what is next up, and what is a downgrade", () => {
    expect(nextPlanUp("free")).toBe("pro");
    expect(nextPlanUp("pro")).toBe("premium");
    expect(nextPlanUp("premium")).toBeNull();
    expect(isDowngrade("premium", "pro")).toBe(true);
    expect(isDowngrade("free", "pro")).toBe(false);
  });
});

// ---------- activity ----------

describe("activity feed", () => {
  it("turns action codes into sentences a person can act on", () => {
    audit(userId, "password_reset.completed", "revoked 2 session(s)");
    audit(userId, "login.success");
    const { entries } = userActivity(userId);
    expect(entries[0].label).toBe("Signed in");
    expect(entries[1].label).toBe("Password changed");
    expect(entries[1].notable).toBe(true);
  });

  it("shows the newest first and counts the total", () => {
    for (let i = 0; i < 5; i++) audit(userId, "login.success");
    const page = userActivity(userId, { limit: 2 });
    expect(page.entries).toHaveLength(2);
    expect(page.total).toBe(5);
  });

  it("filters by category", () => {
    audit(userId, "login.success");
    audit(userId, "billing.paused");
    expect(userActivity(userId, { kind: "billing" }).entries).toHaveLength(1);
  });

  it("renders an unknown code readably rather than hiding it", () => {
    // A feed that silently drops what it does not recognise is worse than one
    // showing a rough label.
    audit(userId, "billing.refund_issued");
    expect(userActivity(userId).entries[0].label).toBe("Billing: refund issued");
  });

  it("never leaks another account's history", async () => {
    const other = await createUser("other@example.com", "Other", "hash");
    audit(other.id, "login.success");
    expect(userActivity(userId).entries).toHaveLength(0);
  });
});
