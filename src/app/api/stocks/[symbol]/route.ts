import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getHistory, getQuote, getStockInfo, rangeChangePct } from "@/lib/marketdata";
import { getNews } from "@/lib/news";
import { scoreStock } from "@/lib/insight/score";
import { TIMEFRAMES, type Timeframe } from "@/lib/types";

type Params = { params: Promise<{ symbol: string }> };

export async function GET(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol } = await params;
  const info = getStockInfo(symbol);
  if (!info) return NextResponse.json({ error: "unknown symbol" }, { status: 404 });

  const rangeParam = (new URL(req.url).searchParams.get("range") ?? "1M") as Timeframe;
  const range = TIMEFRAMES.includes(rangeParam) ? rangeParam : "1M";

  const quote = getQuote(info.symbol);
  const history = getHistory(info.symbol, range);
  const trends = Object.fromEntries(TIMEFRAMES.map((tf) => [tf, rangeChangePct(info.symbol, tf)]));
  const news = getNews(info.symbol, quote.changePct);

  const score = scoreStock(info.symbol);
  return NextResponse.json({ info, quote, range, history, trends, news, score });
}
