import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { audit, limitRequest, tooManyRequests } from "@/lib/security";
import {
  answeredQuestions, clearAnswers, QUESTION_BANK, REQUIRED_ANSWERS, saveAnswers,
} from "@/lib/securityQuestions";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    bank: QUESTION_BANK,
    required: REQUIRED_ANSWERS,
    // Which questions are set, never the answers.
    answered: answeredQuestions(user.id),
  });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = limitRequest(req, "emailVerify", String(user.id));
  if (!limit.allowed) return tooManyRequests(limit);

  const { answers } = (await req.json().catch(() => ({}))) as {
    answers?: { questionId: string; answer: string }[];
  };
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "answers are required" }, { status: 400 });
  }

  const result = await saveAnswers(user.id, answers);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  audit(user.id, "security_questions.set", `${answers.length} answers`, req);
  return NextResponse.json({ ok: true, answered: answeredQuestions(user.id) });
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  clearAnswers(user.id);
  audit(user.id, "security_questions.set", "cleared", req);
  return NextResponse.json({ ok: true });
}
