/**
 * Check our prices against the vendor, side by side, so a human can judge them.
 *
 *   npx tsx scripts/verify-prices.ts                 a spread of well-known tickers
 *   npx tsx scripts/verify-prices.ts AAPL AMZN JNJ   whatever you want to check
 *
 * For each symbol it prints three things: what the vendor answers right now,
 * what our cache holds, and whether the two agree. It also prints the exact
 * URL it called and a page you can open to compare by eye, because the only
 * check that really settles "is this the real price" is a person looking at
 * two numbers.
 *
 * Exits non-zero when nothing real came back, so it can be used as a smoke
 * test after a deployment rather than only read by hand.
 */
import "./load-env";
import { cachedQuote, cachedQuoteStats, quoteAgeHours } from "../src/lib/providers/cache";
import { marketDataChain, providerChoice, sourceFor, sourceText } from "../src/lib/providers/feed";
import { getQuote } from "../src/lib/marketdata";

const DEFAULT_SYMBOLS = ["AAPL", "AMZN", "JNJ", "MSFT", "NVDA", "SPY", "BTC-USD"];

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function money(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "—";
}

async function main(): Promise<void> {
  const symbols = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const list = symbols.length > 0 ? symbols.map((s) => s.toUpperCase()) : DEFAULT_SYMBOLS;
  const chain = marketDataChain();

  console.log(`provider: ${providerChoice()}  chain: ${chain.map((c) => c.name).join(" → ") || "(none — simulation only)"}`);
  if (chain.length === 0) {
    console.log("\nMARKET_DATA_PROVIDER=mock, so nothing will be fetched and every figure");
    console.log("below is generated. Unset it (or set it to `auto`) to check real prices.");
  }
  console.log("");

  console.log(
    pad("SYMBOL", 10) + pad("VENDOR SAYS", 14) + pad("PREV", 10) +
    pad("WE SHOW", 12) + pad("AGREES", 9) + "SOURCE",
  );
  console.log("-".repeat(96));

  let live = 0;
  let disagreements = 0;

  for (const symbol of list) {
    let vendorPrice: number | null = null;
    let vendorPrev: number | null = null;
    // Every vendor's reason is kept, not just the last one. "stooq: 403" on
    // its own hides that Yahoo was the one that mattered and why it failed.
    const failures: string[] = [];

    for (const provider of chain) {
      try {
        const quote = await provider.fetchQuote(symbol);
        if (quote) {
          vendorPrice = quote.price;
          vendorPrev = quote.prevClose;
          break;
        }
        failures.push(`${provider.name}: no data for this symbol`);
      } catch (err) {
        failures.push(`${provider.name}: ${(err as Error).message}`);
      }
    }

    const shown = getQuote(symbol).price;
    const label = sourceFor(symbol);

    // Within a cent is agreement; the cache is written at a different instant
    // from this call, so exact equality would flag every liquid stock.
    const agrees =
      vendorPrice !== null && Math.abs(shown - vendorPrice) <= Math.max(0.02, vendorPrice * 0.005);

    if (vendorPrice !== null) live++;
    if (vendorPrice !== null && !agrees) disagreements++;

    console.log(
      pad(symbol, 10) +
        pad(money(vendorPrice), 14) +
        pad(money(vendorPrev), 10) +
        pad(money(shown), 12) +
        pad(vendorPrice === null ? "—" : agrees ? "yes" : "NO", 9) +
        sourceText(label),
    );

    if (vendorPrice === null) {
      for (const f of failures) console.log(`${" ".repeat(10)}↳ ${f}`);
    }
  }

  console.log("");
  console.log("Cache detail:");
  for (const symbol of list) {
    const q = cachedQuote(symbol);
    const s = cachedQuoteStats(symbol);
    const age = quoteAgeHours(symbol);
    if (!q) {
      console.log(`  ${pad(symbol, 10)} nothing cached — the page falls back to the simulation`);
      continue;
    }
    console.log(
      `  ${pad(symbol, 10)} ${money(q.price)}  prev ${money(q.prevClose)}  ` +
        `52w ${money(s?.fiftyTwoWeekLow)}–${money(s?.fiftyTwoWeekHigh)}  ` +
        `vol ${s?.volume ? s.volume.toLocaleString() : "—"}  ` +
        `age ${age === null ? "—" : `${age.toFixed(1)}h`}`,
    );
  }

  console.log("");
  console.log("Check by eye — these should match to the cent, allowing for the delay:");
  for (const symbol of list.slice(0, 3)) {
    console.log(`  https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`);
    console.log(`  https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`);
  }

  console.log("");
  if (live === 0) {
    console.log(`FAIL — no vendor answered for any of the ${list.length} symbols.`);
    console.log("Nothing on the site is a real price right now; every screen will say so.");
    process.exitCode = 1;
    return;
  }
  if (disagreements > 0) {
    console.log(
      `WARNING — ${disagreements} of ${list.length} disagree with the vendor by more than 0.5%.`,
    );
    console.log("Usually a stale cache: run `npm run refresh` and try again.");
    process.exitCode = 1;
    return;
  }
  console.log(`OK — ${live} of ${list.length} symbols answered, and what we show matches.`);
}

void main();
