import { anyProviderConfigured, getRouter } from "../llm";
import type { DigestFacts, DigestWriter } from "../types";

/**
 * The digest writer turns DigestFacts into plain-language prose.
 *
 * Narration is routed through the multi-provider LLM router (Gemini primary,
 * Anthropic and OpenAI as automatic backups). If every provider is rate
 * limited or unconfigured, it falls back to a deterministic template so the
 * product never hard-fails on a quota wall.
 *
 * The writer never predicts prices and never receives numbers other than the
 * computed facts — the system prompt constrains it to explain, not advise.
 */

export interface WrittenDigest {
  headline: string;
  body: string;
  writer: DigestWriter;
}

const SYSTEM_PROMPT = `You write a daily portfolio digest for a retail investor.

You receive a JSON object of computed facts about one watchlist group:
total value, the day's percentage change, and per-holding data (day change,
portfolio weight, contribution to the group's move, and related news items).

Rules:
- Explain WHY the group moved today, in plain language, leading with the
  biggest contributors. Connect price moves to the provided news where the
  news plausibly explains them.
- Use ONLY the numbers present in the facts. Never invent figures.
- Never predict future prices and never tell the reader to buy or sell.
  This is analytics and education, not investment advice.
- Keep it tight: a headline line, then 2-4 short paragraphs.

Respond in exactly this format:
HEADLINE: <one sentence, under 15 words>
BODY:
<the digest body>`;

export async function writeDigest(facts: DigestFacts, deep: boolean): Promise<WrittenDigest> {
  if (!anyProviderConfigured()) return writeWithTemplate(facts, deep);

  try {
    const res = await getRouter().complete({
      system: SYSTEM_PROMPT,
      user:
        `Depth: ${deep ? "deep (per-holding detail for a Pro subscriber)" : "summary (top movers only, free tier)"}\n` +
        `Facts:\n${JSON.stringify(facts)}`,
      maxTokens: 1500,
    });
    return { ...parseDigest(res.text, facts), writer: res.provider };
  } catch (err) {
    // Every provider exhausted (or a bad request) — degrade, never 500.
    console.error("[digest] all LLM providers failed, using template:", err);
    return writeWithTemplate(facts, deep);
  }
}

function parseDigest(text: string, facts: DigestFacts): { headline: string; body: string } {
  const headlineMatch = text.match(/HEADLINE:\s*(.+)/);
  const bodyMatch = text.match(/BODY:\s*\n?([\s\S]+)/);
  if (!headlineMatch || !bodyMatch) {
    return { headline: defaultHeadline(facts), body: text.trim() };
  }
  return { headline: headlineMatch[1].trim(), body: bodyMatch[1].trim() };
}

// ---------- deterministic template writer ----------

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function defaultHeadline(facts: DigestFacts): string {
  const dir = facts.dayChangePct >= 0 ? "up" : "down";
  const driver = facts.topContributors[0];
  return driver
    ? `${facts.groupName} ${dir} ${pct(facts.dayChangePct)} today, led by ${driver.symbol}`
    : `${facts.groupName} ${dir} ${pct(facts.dayChangePct)} today`;
}

export function writeWithTemplate(facts: DigestFacts, deep: boolean): WrittenDigest {
  const lines: string[] = [];
  const dir = facts.dayChangePct >= 0 ? "gained" : "lost";
  lines.push(
    `Your group "${facts.groupName}" ${dir} ${pct(facts.dayChangePct)} today and is now worth ${money(facts.totalValue)}.`,
  );

  for (const c of facts.topContributors.slice(0, deep ? 3 : 2)) {
    const moveDir = c.dayChangePct >= 0 ? "rose" : "fell";
    let line = `${c.name} (${c.symbol}) ${moveDir} ${pct(c.dayChangePct)}, contributing ${pct(c.contributionPct)} of the group's move (${(c.weight * 100).toFixed(1)}% of the portfolio).`;
    const topNews = c.news[0];
    if (topNews) line += ` Likely driver: ${topNews.headline} (${topNews.source}).`;
    lines.push(line);
  }

  if (deep) {
    const quiet = facts.holdings.filter(
      (h) => !facts.topContributors.slice(0, 3).some((c) => c.symbol === h.symbol),
    );
    if (quiet.length > 0) {
      const quietSummary = quiet.map((h) => `${h.symbol} ${pct(h.dayChangePct)}`).join(", ");
      lines.push(`Elsewhere in the group: ${quietSummary}.`);
    }
  }

  lines.push(
    "This digest explains today's moves using computed portfolio math and related headlines. It is not investment advice.",
  );

  return { headline: defaultHeadline(facts), body: lines.join("\n\n"), writer: "template" };
}
