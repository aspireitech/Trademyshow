import bcrypt from "bcryptjs";
import { getDb } from "./db";

/**
 * Security questions.
 *
 * A deliberate note on what these are for: NIST 800-63B withdrew security
 * questions as an authentication factor, because the answers are often public
 * (a maiden name, a school), shared across sites, and never revocable once
 * leaked. So they are NOT an authentication factor here and never reset a
 * password on their own — they are a support-desk aid, proving continuity of
 * identity alongside a channel that is itself verified.
 *
 * Answers are bcrypt hashes, normalised for case and spacing so "St Mary's"
 * and "st marys" match, because a question a user cannot answer twice the same
 * way is worse than no question at all.
 */

export interface SecurityQuestion {
  id: string;
  text: string;
}

/**
 * Chosen to have answers that are stable for life, unambiguous to type, and
 * not discoverable from a social media profile — which rules out most of the
 * classics.
 */
export const QUESTION_BANK: SecurityQuestion[] = [
  { id: "first_employer", text: "What was the name of your first employer?" },
  { id: "childhood_street", text: "What street did you live on when you were ten?" },
  { id: "first_concert", text: "What was the first concert or live event you attended?" },
  { id: "oldest_cousin", text: "What is the first name of your oldest cousin?" },
  { id: "childhood_nickname", text: "What nickname were you called as a child?" },
  { id: "first_pet_vet", text: "What was the name of your first pet's vet or clinic?" },
  { id: "favourite_teacher", text: "What was the surname of your favourite teacher?" },
  { id: "first_car_colour", text: "What make and colour was your first car?" },
];

export const REQUIRED_ANSWERS = 3;

const BY_ID = new Map(QUESTION_BANK.map((q) => [q.id, q]));

export function isKnownQuestion(id: string): boolean {
  return BY_ID.has(id);
}

/** Case, spacing and punctuation are not part of the secret. */
function normalise(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export interface AnswerInput {
  questionId: string;
  answer: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function saveAnswers(userId: number, answers: AnswerInput[]): Promise<SaveResult> {
  if (answers.length < REQUIRED_ANSWERS) {
    return { ok: false, error: `Choose and answer ${REQUIRED_ANSWERS} questions.` };
  }
  const ids = new Set(answers.map((a) => a.questionId));
  if (ids.size !== answers.length) {
    return { ok: false, error: "Each question can only be answered once." };
  }
  for (const a of answers) {
    if (!isKnownQuestion(a.questionId)) return { ok: false, error: "Unknown question." };
    // Two characters is not an answer; it is a coin flip an attacker can win.
    if (normalise(a.answer).length < 3) {
      return { ok: false, error: "Answers need at least three characters." };
    }
  }

  const hashed = await Promise.all(
    answers.map(async (a) => ({ id: a.questionId, hash: await bcrypt.hash(normalise(a.answer), 10) })),
  );

  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM security_answers WHERE user_id = ?").run(userId);
    const stmt = db.prepare(
      "INSERT INTO security_answers (user_id, question_id, answer_hash) VALUES (?, ?, ?)",
    );
    for (const h of hashed) stmt.run(userId, h.id, h.hash);
  })();

  return { ok: true };
}

/** Which questions this account has set, without revealing any answer. */
export function answeredQuestions(userId: number): SecurityQuestion[] {
  const rows = getDb()
    .prepare("SELECT question_id FROM security_answers WHERE user_id = ? ORDER BY id")
    .all(userId) as { question_id: string }[];
  return rows.map((r) => BY_ID.get(r.question_id)).filter((q): q is SecurityQuestion => Boolean(q));
}

export function hasAnswers(userId: number): boolean {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM security_answers WHERE user_id = ?")
    .get(userId) as { n: number };
  return row.n >= REQUIRED_ANSWERS;
}

/**
 * Verify submitted answers. Every stored answer must match: partial credit
 * turns three weak secrets into one weak secret.
 */
export async function verifyAnswers(userId: number, answers: AnswerInput[]): Promise<boolean> {
  const rows = getDb()
    .prepare("SELECT question_id, answer_hash FROM security_answers WHERE user_id = ?")
    .all(userId) as { question_id: string; answer_hash: string }[];
  if (rows.length === 0 || answers.length !== rows.length) return false;

  for (const row of rows) {
    const submitted = answers.find((a) => a.questionId === row.question_id);
    if (!submitted) return false;
    if (!(await bcrypt.compare(normalise(submitted.answer), row.answer_hash))) return false;
  }
  return true;
}

export function clearAnswers(userId: number): void {
  getDb().prepare("DELETE FROM security_answers WHERE user_id = ?").run(userId);
}
