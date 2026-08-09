import Anthropic from "@anthropic-ai/sdk";
import type { DigestFacts } from "../types";

/**
 * The digest writer turns DigestFacts into plain-language prose. Two
 * implementations:
 *  - Claude (when ANTHROPIC_API_KEY is set): natural, contextual narration.
 *  - Template (fallback): deterministic prose so the app works offline and
 *    in tests. Same output shape either way.
 *
 * The writer never predicts prices and never receives numbers other than
 * the computed facts — the system prompt constrains it to explain, not advise.
 */

export interface WrittenDigest {
  headline: string;
  body: string;
  writer: "claude" | "template";
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
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await writeWithClaude(facts, deep);
    } catch (err) {
      console.error("Claude digest failed, falling back to template:", err);
    }
  }
  return writeWithTemplate(facts, deep);
}

async function writeWithClaude(facts: DigestFacts, deep: boolean): Promise<WrittenDigest> {
  const client = new Anthropic();
  const userContent =
    `Depth: ${deep ? "deep (per-holding detail for a Pro subscriber)" : "summary (top movers only, free tier)"}\n` +
    `Facts:\n${JSON.stringify(facts)}`;

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "refusal") {
    // Safety classifiers declined — fall back to the deterministic writer.
    return writeWithTemplate(facts, deep);
  }

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  const headlineMatch = text.match(/HEADLINE:\s*(.+)/);
  const bodyMatch = text.match(/BODY:\s*\n?([\s\S]+)/);
  if (!headlineMatch || !bodyMatch) {
    return { headline: defaultHeadline(facts), body: text.trim(), writer: "claude" };
  }
  return {
    headline: headlineMatch[1].trim(),
    body: bodyMatch[1].trim(),
    writer: "claude",
  };
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
      const quietSummary = quiet
        .map((h) => `${h.symbol} ${pct(h.dayChangePct)}`)
        .join(", ");
      lines.push(`Elsewhere in the group: ${quietSummary}.`);
    }
  }

  lines.push(
    "This digest explains today's moves using computed portfolio math and related headlines. It is not investment advice.",
  );

  return {
    headline: defaultHeadline(facts),
    body: lines.join("\n\n"),
    writer: "template",
  };
}
