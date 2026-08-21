import {
  cachedCloses, cachedIntraday, cachedQuote, cachedQuoteStats, knownSymbol, searchDirectory,
} from "./providers/cache";
import { liveDataEnabled } from "./providers/feed";
import type { AssetClass, PricePoint, Quote, QuoteStats, StockInfo, Timeframe } from "./types";

/**
 * Market data: the real feed first, the simulation only as a floor.
 *
 * Every read here follows the same rule. If a vendor's number for this symbol
 * is in the cache and fresh enough to stand behind, that is what comes back.
 * Otherwise a seeded random walk answers — deterministic, keyed by symbol and
 * anchored to the calendar, so the same (symbol, date) always yields the same
 * series and the test suite and published track record stay reproducible.
 *
 * The walk is not a stand-in for a quote and must never be presented as one.
 * `sourceFor()` in providers/feed.ts tells every screen which of the two it is
 * looking at, and the screens say so.
 */

export const UNIVERSE: StockInfo[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology" },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors" },
  { symbol: "META", name: "Meta Platforms Inc.", sector: "Technology" },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Automotive" },
  { symbol: "TSM", name: "Taiwan Semiconductor", sector: "Semiconductors" },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors" },
  { symbol: "INTC", name: "Intel Corp.", sector: "Semiconductors" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { symbol: "BAC", name: "Bank of America Corp.", sector: "Financials" },
  { symbol: "GS", name: "Goldman Sachs Group", sector: "Financials" },
  { symbol: "V", name: "Visa Inc.", sector: "Financials" },
  { symbol: "MA", name: "Mastercard Inc.", sector: "Financials" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
  { symbol: "LLY", name: "Eli Lilly & Co.", sector: "Healthcare" },
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy" },
  { symbol: "CVX", name: "Chevron Corp.", sector: "Energy" },
  { symbol: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples" },
  { symbol: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples" },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Staples" },
  { symbol: "PG", name: "Procter & Gamble Co.", sector: "Consumer Staples" },
  { symbol: "DIS", name: "Walt Disney Co.", sector: "Media" },
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Media" },
  { symbol: "BA", name: "Boeing Co.", sector: "Industrials" },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials" },
  { symbol: "UBER", name: "Uber Technologies", sector: "Technology" },
  { symbol: "SHOP", name: "Shopify Inc.", sector: "Technology" },
  { symbol: "PLTR", name: "Palantir Technologies", sector: "Technology" },
  { symbol: "COIN", name: "Coinbase Global", sector: "Financials" },
  { symbol: "SQ", name: "Block Inc.", sector: "Financials" },

  { symbol: "ORCL", name: "Oracle Corp.", sector: "Technology" },
  { symbol: "CRM", name: "Salesforce Inc.", sector: "Technology" },
  { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology" },
  { symbol: "CSCO", name: "Cisco Systems", sector: "Technology" },
  { symbol: "IBM", name: "IBM Corp.", sector: "Technology" },
  { symbol: "QCOM", name: "Qualcomm Inc.", sector: "Semiconductors" },
  { symbol: "TXN", name: "Texas Instruments", sector: "Semiconductors" },
  { symbol: "AVGO", name: "Broadcom Inc.", sector: "Semiconductors" },
  { symbol: "MU", name: "Micron Technology", sector: "Semiconductors" },
  { symbol: "ARM", name: "Arm Holdings", sector: "Semiconductors" },
  { symbol: "ASML", name: "ASML Holding", sector: "Semiconductors" },
  { symbol: "LRCX", name: "Lam Research", sector: "Semiconductors" },
  { symbol: "KLAC", name: "KLA Corp.", sector: "Semiconductors" },
  { symbol: "SNOW", name: "Snowflake Inc.", sector: "Technology" },
  { symbol: "NOW", name: "ServiceNow Inc.", sector: "Technology" },
  { symbol: "INTU", name: "Intuit Inc.", sector: "Technology" },
  { symbol: "PANW", name: "Palo Alto Networks", sector: "Technology" },
  { symbol: "CRWD", name: "CrowdStrike Holdings", sector: "Technology" },
  { symbol: "NET", name: "Cloudflare Inc.", sector: "Technology" },
  { symbol: "DDOG", name: "Datadog Inc.", sector: "Technology" },
  { symbol: "MDB", name: "MongoDB Inc.", sector: "Technology" },
  { symbol: "TEAM", name: "Atlassian Corp.", sector: "Technology" },
  { symbol: "ZS", name: "Zscaler Inc.", sector: "Technology" },
  { symbol: "OKTA", name: "Okta Inc.", sector: "Technology" },
  { symbol: "TWLO", name: "Twilio Inc.", sector: "Technology" },
  { symbol: "ABNB", name: "Airbnb Inc.", sector: "Consumer Discretionary" },
  { symbol: "BKNG", name: "Booking Holdings", sector: "Consumer Discretionary" },
  { symbol: "MAR", name: "Marriott International", sector: "Consumer Discretionary" },
  { symbol: "SBUX", name: "Starbucks Corp.", sector: "Consumer Discretionary" },
  { symbol: "MCD", name: "McDonald's Corp.", sector: "Consumer Discretionary" },
  { symbol: "NKE", name: "Nike Inc.", sector: "Consumer Discretionary" },
  { symbol: "LULU", name: "Lululemon Athletica", sector: "Consumer Discretionary" },
  { symbol: "TGT", name: "Target Corp.", sector: "Consumer Staples" },
  { symbol: "COST", name: "Costco Wholesale", sector: "Consumer Staples" },
  { symbol: "KR", name: "Kroger Co.", sector: "Consumer Staples" },
  { symbol: "CL", name: "Colgate-Palmolive", sector: "Consumer Staples" },
  { symbol: "MDLZ", name: "Mondelez International", sector: "Consumer Staples" },
  { symbol: "PM", name: "Philip Morris Intl", sector: "Consumer Staples" },
  { symbol: "HD", name: "Home Depot Inc.", sector: "Consumer Discretionary" },
  { symbol: "LOW", name: "Lowe's Companies", sector: "Consumer Discretionary" },
  { symbol: "F", name: "Ford Motor Co.", sector: "Automotive" },
  { symbol: "GM", name: "General Motors", sector: "Automotive" },
  { symbol: "RIVN", name: "Rivian Automotive", sector: "Automotive" },
  { symbol: "TM", name: "Toyota Motor", sector: "Automotive" },
  { symbol: "WFC", name: "Wells Fargo & Co.", sector: "Financials" },
  { symbol: "C", name: "Citigroup Inc.", sector: "Financials" },
  { symbol: "MS", name: "Morgan Stanley", sector: "Financials" },
  { symbol: "SCHW", name: "Charles Schwab", sector: "Financials" },
  { symbol: "BLK", name: "BlackRock Inc.", sector: "Financials" },
  { symbol: "AXP", name: "American Express", sector: "Financials" },
  { symbol: "PYPL", name: "PayPal Holdings", sector: "Financials" },
  { symbol: "HOOD", name: "Robinhood Markets", sector: "Financials" },
  { symbol: "SOFI", name: "SoFi Technologies", sector: "Financials" },
  { symbol: "BRK.B", name: "Berkshire Hathaway", sector: "Financials" },
  { symbol: "ABBV", name: "AbbVie Inc.", sector: "Healthcare" },
  { symbol: "MRK", name: "Merck & Co.", sector: "Healthcare" },
  { symbol: "BMY", name: "Bristol-Myers Squibb", sector: "Healthcare" },
  { symbol: "AMGN", name: "Amgen Inc.", sector: "Healthcare" },
  { symbol: "GILD", name: "Gilead Sciences", sector: "Healthcare" },
  { symbol: "MRNA", name: "Moderna Inc.", sector: "Healthcare" },
  { symbol: "ISRG", name: "Intuitive Surgical", sector: "Healthcare" },
  { symbol: "MDT", name: "Medtronic plc", sector: "Healthcare" },
  { symbol: "TMO", name: "Thermo Fisher Scientific", sector: "Healthcare" },
  { symbol: "ABT", name: "Abbott Laboratories", sector: "Healthcare" },
  { symbol: "CVS", name: "CVS Health Corp.", sector: "Healthcare" },
  { symbol: "NVO", name: "Novo Nordisk", sector: "Healthcare" },
  { symbol: "COP", name: "ConocoPhillips", sector: "Energy" },
  { symbol: "SLB", name: "Schlumberger Ltd.", sector: "Energy" },
  { symbol: "OXY", name: "Occidental Petroleum", sector: "Energy" },
  { symbol: "EOG", name: "EOG Resources", sector: "Energy" },
  { symbol: "NEE", name: "NextEra Energy", sector: "Utilities" },
  { symbol: "DUK", name: "Duke Energy", sector: "Utilities" },
  { symbol: "SO", name: "Southern Co.", sector: "Utilities" },
  { symbol: "D", name: "Dominion Energy", sector: "Utilities" },
  { symbol: "HON", name: "Honeywell International", sector: "Industrials" },
  { symbol: "UNP", name: "Union Pacific", sector: "Industrials" },
  { symbol: "UPS", name: "United Parcel Service", sector: "Industrials" },
  { symbol: "FDX", name: "FedEx Corp.", sector: "Industrials" },
  { symbol: "DE", name: "Deere & Co.", sector: "Industrials" },
  { symbol: "LMT", name: "Lockheed Martin", sector: "Industrials" },
  { symbol: "RTX", name: "RTX Corp.", sector: "Industrials" },
  { symbol: "NOC", name: "Northrop Grumman", sector: "Industrials" },
  { symbol: "DAL", name: "Delta Air Lines", sector: "Industrials" },
  { symbol: "UAL", name: "United Airlines", sector: "Industrials" },
  { symbol: "T", name: "AT&T Inc.", sector: "Telecom" },
  { symbol: "VZ", name: "Verizon Communications", sector: "Telecom" },
  { symbol: "TMUS", name: "T-Mobile US", sector: "Telecom" },
  { symbol: "CMCSA", name: "Comcast Corp.", sector: "Media" },
  { symbol: "WBD", name: "Warner Bros. Discovery", sector: "Media" },
  { symbol: "SPOT", name: "Spotify Technology", sector: "Media" },
  { symbol: "RBLX", name: "Roblox Corp.", sector: "Media" },
  { symbol: "LIN", name: "Linde plc", sector: "Materials" },
  { symbol: "FCX", name: "Freeport-McMoRan", sector: "Materials" },
  { symbol: "NEM", name: "Newmont Corp.", sector: "Materials" },
  { symbol: "DOW", name: "Dow Inc.", sector: "Materials" },
  { symbol: "PLD", name: "Prologis Inc.", sector: "Real Estate" },
  { symbol: "AMT", name: "American Tower", sector: "Real Estate" },
  { symbol: "O", name: "Realty Income Corp.", sector: "Real Estate" },

  // Funds. Most people's first watchlist is an index tracker plus a handful of
  // names, so leaving ETFs out makes the product feel broken on day one.
  { symbol: "SPY", name: "SPDR S&P 500 ETF", sector: "Broad market", assetClass: "etf" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", sector: "Broad market", assetClass: "etf" },
  { symbol: "QQQ", name: "Invesco Nasdaq 100 ETF", sector: "Broad market", assetClass: "etf" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", sector: "Broad market", assetClass: "etf" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", sector: "Small cap", assetClass: "etf" },
  { symbol: "VEA", name: "Vanguard Developed Markets ETF", sector: "International", assetClass: "etf" },
  { symbol: "VWO", name: "Vanguard Emerging Markets ETF", sector: "International", assetClass: "etf" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF", sector: "Semiconductors", assetClass: "etf" },
  { symbol: "XLE", name: "Energy Select Sector SPDR", sector: "Energy", assetClass: "etf" },
  { symbol: "XLF", name: "Financial Select Sector SPDR", sector: "Financials", assetClass: "etf" },
  { symbol: "XLV", name: "Health Care Select Sector SPDR", sector: "Healthcare", assetClass: "etf" },
  { symbol: "AGG", name: "iShares Core US Aggregate Bond ETF", sector: "Bonds", assetClass: "etf" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", sector: "Bonds", assetClass: "etf" },
  { symbol: "GLD", name: "SPDR Gold Shares", sector: "Commodities", assetClass: "etf" },

  // Crypto, priced in USD. Included because people watch it next to equities,
  // scored by the same maths — no separate model, no separate promises.
  { symbol: "BTC-USD", name: "Bitcoin", sector: "Digital assets", assetClass: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum", sector: "Digital assets", assetClass: "crypto" },
  { symbol: "SOL-USD", name: "Solana", sector: "Digital assets", assetClass: "crypto" },
];

/** Everything defaults to an ordinary equity unless it says otherwise. */
export function assetClassOf(symbol: string): AssetClass {
  return BY_SYMBOL.get(symbol.toUpperCase())?.assetClass ?? "stock";
}

const BY_SYMBOL = new Map(UNIVERSE.map((s) => [s.symbol, s]));

/**
 * The instrument behind a symbol.
 *
 * The shipped universe answers first — it is a map lookup and covers what
 * most people type. Anything else falls through to the directory of symbols
 * learned from the vendor's search, which is what lets a visitor who looks up
 * a small cap get a working page instead of a 404.
 */
export function getStockInfo(symbol: string): StockInfo | null {
  const shipped = BY_SYMBOL.get(symbol.toUpperCase());
  if (shipped) return shipped;
  if (!liveDataEnabled()) return null;
  try {
    return knownSymbol(symbol);
  } catch {
    // No database (a unit test, a build-time render): the universe is all
    // there is, and a null here reads as "unknown symbol", which is true.
    return null;
  }
}

export function searchStocks(query: string, limit = 8): StockInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = UNIVERSE.filter(
    (s) =>
      s.symbol.toLowerCase().startsWith(q) ||
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().startsWith(q),
  );
  // A symbol match is what the user typed; a name or sector match is a guess.
  // Ranking them together buries "V" under "Vanguard" and "VanEck".
  matches.sort((a, b) => {
    const aSym = a.symbol.toLowerCase().startsWith(q) ? 0 : 1;
    const bSym = b.symbol.toLowerCase().startsWith(q) ? 0 : 1;
    return aSym - bSym || a.symbol.length - b.symbol.length;
  });
  if (matches.length >= limit || !liveDataEnabled()) return matches.slice(0, limit);

  // Top up from symbols already learned from the vendor, so the second person
  // to type "APLM" gets it without a round trip.
  const seen = new Set(matches.map((m) => m.symbol));
  try {
    for (const hit of searchDirectory(query, limit)) {
      if (!seen.has(hit.symbol)) matches.push(hit);
    }
  } catch {
    // No database available; the universe matches stand on their own.
  }
  return matches.slice(0, limit);
}

// ---------- deterministic PRNG ----------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- price series ----------

const ALL_DAYS = 6 * 365; // "ALL" horizon on the price chart
const EPOCH = Date.UTC(2000, 0, 1);

function dayIndex(d: Date): number {
  return Math.floor((d.getTime() - EPOCH) / 86_400_000);
}

/**
 * Reference level and market cap for each instrument: [price in USD, market cap
 * in USD billions].
 *
 * These exist to keep the simulation internally coherent. A random walk from an
 * arbitrary starting point produces prices that are individually plausible but
 * collectively absurd — a sector ETF trading above the index it tracks, a bank
 * quoted in the thousands. Anyone who follows markets spots that immediately,
 * and it makes the whole product look untrustworthy. Pinning each walk to a
 * realistic level fixes that without changing a single percentage: the scaling
 * is uniform, so returns, scores and sparklines are all unaffected.
 *
 * They are reference points for a simulation, not quotes. Every screen that
 * shows them is labelled as simulated data.
 */
const ANCHORS: Record<string, [price: number, capB: number]> = {
  "AAPL": [230, 3450],
  "MSFT": [480, 3570],
  "GOOGL": [195, 2380],
  "AMZN": [220, 2320],
  "NVDA": [175, 4250],
  "META": [700, 1760],
  "TSLA": [340, 1090],
  "TSM": [250, 1300],
  "AMD": [165, 267],
  "INTC": [25, 108],
  "JPM": [290, 810],
  "BAC": [47, 355],
  "GS": [620, 190],
  "V": [340, 660],
  "MA": [560, 515],
  "JNJ": [165, 397],
  "PFE": [26, 147],
  "UNH": [320, 290],
  "LLY": [830, 790],
  "XOM": [115, 495],
  "CVX": [155, 280],
  "KO": [70, 300],
  "PEP": [145, 199],
  "WMT": [100, 800],
  "PG": [160, 375],
  "DIS": [110, 199],
  "NFLX": [1100, 468],
  "BA": [200, 150],
  "CAT": [400, 190],
  "GE": [250, 268],
  "UBER": [88, 184],
  "SHOP": [120, 155],
  "PLTR": [160, 375],
  "COIN": [320, 81],
  "SQ": [75, 46],
  "ORCL": [230, 645],
  "CRM": [260, 249],
  "ADBE": [370, 157],
  "CSCO": [68, 270],
  "IBM": [275, 255],
  "QCOM": [160, 175],
  "TXN": [190, 173],
  "AVGO": [330, 1550],
  "MU": [175, 196],
  "ARM": [140, 148],
  "ASML": [900, 355],
  "LRCX": [105, 133],
  "KLAC": [900, 119],
  "SNOW": [220, 73],
  "NOW": [950, 196],
  "INTU": [640, 179],
  "PANW": [195, 129],
  "CRWD": [470, 116],
  "NET": [190, 66],
  "DDOG": [130, 45],
  "MDB": [320, 26],
  "TEAM": [200, 52],
  "ZS": [280, 43],
  "OKTA": [100, 17],
  "TWLO": [110, 17],
  "ABNB": [130, 81],
  "BKNG": [5200, 172],
  "MAR": [270, 74],
  "SBUX": [92, 105],
  "MCD": [300, 215],
  "NKE": [72, 107],
  "LULU": [190, 23],
  "TGT": [95, 43],
  "COST": [940, 417],
  "KR": [68, 45],
  "CL": [85, 69],
  "MDLZ": [62, 81],
  "PM": [165, 257],
  "HD": [380, 377],
  "LOW": [240, 136],
  "F": [11, 44],
  "GM": [55, 54],
  "RIVN": [14, 16],
  "TM": [190, 250],
  "WFC": [78, 258],
  "C": [90, 168],
  "MS": [135, 217],
  "SCHW": [88, 160],
  "BLK": [1050, 163],
  "AXP": [300, 210],
  "PYPL": [68, 66],
  "HOOD": [110, 97],
  "SOFI": [22, 25],
  "BRK.B": [490, 1060],
  "ABBV": [210, 371],
  "MRK": [85, 213],
  "BMY": [47, 96],
  "AMGN": [285, 153],
  "GILD": [115, 143],
  "MRNA": [27, 10],
  "ISRG": [520, 185],
  "MDT": [92, 118],
  "TMO": [500, 189],
  "ABT": [130, 226],
  "CVS": [72, 91],
  "NVO": [55, 245],
  "COP": [95, 118],
  "SLB": [36, 49],
  "OXY": [44, 43],
  "EOG": [118, 65],
  "NEE": [72, 148],
  "DUK": [120, 93],
  "SO": [92, 101],
  "D": [58, 49],
  "HON": [215, 138],
  "UNP": [225, 133],
  "UPS": [95, 81],
  "FDX": [240, 57],
  "DE": [480, 130],
  "LMT": [450, 105],
  "RTX": [155, 207],
  "NOC": [560, 81],
  "DAL": [55, 36],
  "UAL": [95, 31],
  "T": [28, 200],
  "VZ": [42, 177],
  "TMUS": [230, 262],
  "CMCSA": [33, 124],
  "WBD": [11, 27],
  "SPOT": [620, 126],
  "RBLX": [110, 72],
  "LIN": [460, 219],
  "FCX": [42, 60],
  "NEM": [62, 70],
  "DOW": [26, 18],
  "PLD": [110, 102],
  "AMT": [200, 93],
  "O": [58, 51],
  "SPY": [640, 640],
  "VOO": [590, 690],
  "QQQ": [570, 380],
  "VTI": [315, 500],
  "IWM": [235, 68],
  "VEA": [55, 150],
  "VWO": [50, 90],
  "SMH": [290, 25],
  "XLE": [88, 27],
  "XLF": [52, 48],
  "XLV": [140, 35],
  "AGG": [98, 125],
  "TLT": [88, 48],
  "GLD": [320, 100],
  "BTC-USD": [95000, 1880],
  "ETH-USD": [3200, 385],
  "SOL-USD": [180, 95],
};

/** Fallback for a symbol with no anchor: stable, and in a sane range. */
function anchorFor(symbol: string): [number, number] {
  const a = ANCHORS[symbol.toUpperCase()];
  if (a) return a;
  const seed = hashString(symbol);
  return [20 + (seed % 380), 5 + (seed % 200)];
}

/** Shares outstanding implied by the anchor pair, so market cap tracks price. */
export function sharesOutstanding(symbol: string): number {
  const [price, capB] = anchorFor(symbol);
  return (capB * 1e9) / price;
}

/**
 * Market cap at the current price, in USD.
 *
 * The vendor's own figure wins where it supplies one. Otherwise this is an
 * estimate — the shipped share count multiplied by the live price — which is
 * accurate to within a buyback or two and is marked as an estimate wherever it
 * is shown. Inventing precision would be worse than admitting the estimate.
 */
export function marketCap(symbol: string, asOf: Date = new Date()): number {
  const stats = fromCache(() => cachedQuoteStats(symbol));
  if (stats?.marketCap) return stats.marketCap;
  return sharesOutstanding(symbol) * getQuote(symbol, asOf).price;
}

/** True when the market cap above is our arithmetic rather than the vendor's. */
export function marketCapIsEstimated(symbol: string): boolean {
  return !fromCache(() => cachedQuoteStats(symbol))?.marketCap;
}

/**
 * Everything the feed volunteered beside the price, or null when the only
 * thing behind this symbol is the simulation.
 */
export function symbolStats(symbol: string): QuoteStats | null {
  return fromCache(() => cachedQuoteStats(symbol));
}

/**
 * The 52-week range, preferring the vendor's own figures.
 *
 * Computing it from cached closes is the fallback, and it is a slightly
 * different number — the vendor tracks intraday extremes, we only hold closes.
 * That difference is why the vendor's version is used when it exists.
 */
export function week52Range(
  symbol: string,
  asOf: Date = new Date(),
): { high: number; low: number } {
  const stats = fromCache(() => cachedQuoteStats(symbol));
  if (stats?.fiftyTwoWeekHigh && stats.fiftyTwoWeekLow) {
    return { high: stats.fiftyTwoWeekHigh, low: stats.fiftyTwoWeekLow };
  }
  const year = getHistory(symbol, "1Y", asOf).map((p) => p.price);
  if (year.length === 0) {
    const price = getQuote(symbol, asOf).price;
    return { high: price, low: price };
  }
  return { high: Math.max(...year), low: Math.min(...year) };
}

/**
 * Simulated share volume for the session. Scaled to the size of the company and
 * inflated on days the stock moved hard, which is how real volume behaves.
 */
export function dayVolume(symbol: string, asOf: Date = new Date()): number {
  const stats = fromCache(() => cachedQuoteStats(symbol));
  if (stats?.volume) return stats.volume;

  const [, capB] = anchorFor(symbol);
  const rand = mulberry32(hashString(`vol:${symbol}:${dayIndex(asOf)}`));
  const turnover = 0.002 + rand() * 0.004; // 0.2%-0.6% of shares change hands
  const move = Math.abs(getQuote(symbol, asOf).changePct);
  return Math.round(sharesOutstanding(symbol) * turnover * (1 + move / 2) * (capB > 500 ? 1.6 : 1));
}

/**
 * Daily closes for a symbol, indexed from a fixed origin day rather than from
 * "today". Absolute indexing is what makes a given calendar date resolve to the
 * same price no matter when it is asked for, which is what the published track
 * record depends on.
 */
const SERIES_ORIGIN = Math.floor((Date.UTC(2015, 0, 1) - EPOCH) / 86_400_000);
const ANCHOR_DAY = Math.floor((Date.UTC(2026, 5, 30) - EPOCH) / 86_400_000);

const seriesCache = new Map<string, number[]>();

function dailySeries(symbol: string, throughDay: number): number[] {
  const cached = seriesCache.get(symbol);
  if (cached && SERIES_ORIGIN + cached.length > throughDay) return cached;

  // Round the length up to a whole year beyond what was asked for. The walk is
  // append-only from a fixed origin, so growing it never changes a price that
  // has already been published, and quantising means the series is rebuilt once
  // a year instead of once a day.
  const len = Math.ceil((throughDay - SERIES_ORIGIN + 1) / 365) * 365;

  const info = getStockInfo(symbol);
  const seed = hashString(symbol);
  const rand = mulberry32(seed);
  const drift = 0.00012 + (info ? hashString(info.sector) % 5 : 0) * 0.00004;
  const vol = 0.009 + ((seed >> 8) % 10) * 0.0011;

  const closes: number[] = new Array(len);
  let level = 1;
  for (let i = 0; i < len; i++) {
    const shock = (rand() - 0.5) * 2 * vol;
    // Occasional event days (earnings-like moves).
    const eventDay = (SERIES_ORIGIN + i + seed) % 63 === 0;
    const eventShock = eventDay ? (rand() - 0.45) * 0.08 : 0;
    level = Math.max(0.02, level * (1 + drift + shock + eventShock));
    closes[i] = level;
  }

  // Scale the whole series so the close on the anchor date matches the
  // instrument's reference level. Uniform scaling leaves every return and
  // percentage untouched; only the units move.
  const at = closes[Math.min(len - 1, Math.max(0, ANCHOR_DAY - SERIES_ORIGIN))];
  const scale = anchorFor(symbol)[0] / at;
  for (let i = 0; i < len; i++) closes[i] *= scale;

  seriesCache.set(symbol, closes);
  return closes;
}

function closeAt(symbol: string, asOf: Date, daysBack: number): number {
  const today = dayIndex(asOf);
  const closes = dailySeries(symbol, today);
  const idx = Math.min(closes.length - 1, Math.max(0, today - daysBack - SERIES_ORIGIN));
  return closes[idx];
}

/**
 * True unless the simulation has been forced on with MARKET_DATA_PROVIDER=mock.
 *
 * The default is live. An installation that shows invented prices by default
 * and only shows real ones when someone remembers to set a variable is an
 * installation that will show invented prices.
 */
export function usingLiveData(): boolean {
  return liveDataEnabled();
}

/**
 * Read the cache without letting its absence break a render.
 *
 * The cache lives in SQLite, and there are contexts — a unit test with no
 * database, a build-time prerender — where opening it is not possible. In
 * those the simulation is the correct answer, so a throw here is a fallback
 * signal, not an error.
 */
function fromCache<T>(read: () => T | null): T | null {
  if (!liveDataEnabled()) return null;
  try {
    return read();
  } catch {
    return null;
  }
}

export function getQuote(symbol: string, asOf: Date = new Date()): Quote {
  // A live quote is only consulted for "now". Historical and back-dated
  // requests stay deterministic, which is what keeps the test suite and the
  // published track record reproducible.
  if (Math.abs(Date.now() - asOf.getTime()) < 60_000) {
    const live = fromCache(() => cachedQuote(symbol));
    if (live) return live;
  }

  const price = closeAt(symbol, asOf, 0);
  const prevClose = closeAt(symbol, asOf, 1);
  return {
    symbol: symbol.toUpperCase(),
    price: round2(price),
    prevClose: round2(prevClose),
    changePct: round2(((price - prevClose) / prevClose) * 100),
  };
}

const RANGE_DAYS: Record<Exclude<Timeframe, "1D" | "YTD" | "ALL">, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 91,
  "6M": 182,
  "1Y": 365,
  "5Y": 5 * 365,
};

/** Calendar days of history a timeframe covers. */
function daysFor(range: Timeframe, asOf: Date): number {
  if (range === "ALL") return ALL_DAYS - 1;
  if (range === "1D") return 1;
  if (range === "YTD") {
    const jan1 = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
    return Math.max(1, dayIndex(asOf) - dayIndex(jan1));
  }
  return RANGE_DAYS[range];
}

/** Thin a series to at most `points` values, keeping both endpoints. */
function thin(points: PricePoint[], max = 260): PricePoint[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: PricePoint[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

/**
 * Real closes for the window, or null when the cache cannot cover it.
 *
 * "Cannot cover it" is deliberately strict: a 1Y chart drawn from three weeks
 * of cached closes is a misleading chart, and silently mixing cached closes
 * with simulated ones to fill the gap would be worse than either alone. Better
 * to hand the whole range back to the simulation, which is labelled.
 */
function cachedHistory(symbol: string, range: Timeframe, asOf: Date): PricePoint[] | null {
  if (range === "1D") {
    const bars = fromCache(() => cachedIntraday(symbol));
    return bars && bars.length > 1 ? bars : null;
  }

  const days = daysFor(range, asOf);
  const since = new Date(asOf.getTime() - days * 86_400_000);
  const closes = fromCache(() => cachedCloses(symbol, since));
  if (!closes || closes.length < 2) return null;

  // Markets trade about five days in seven. Accept anything within half of
  // that — holidays, and genuinely young listings, both legitimately fall
  // short — but reject a window the cache has barely started to fill.
  const tradingDays = days * (5 / 7);
  if (closes.length < Math.min(20, tradingDays * 0.5)) return null;

  return thin(closes);
}

export function getHistory(symbol: string, range: Timeframe, asOf: Date = new Date()): PricePoint[] {
  // Back-dated requests stay on the deterministic walk for the same reason
  // quotes do: the published track record must not be rewritten by whatever
  // the cache happens to hold today.
  if (Math.abs(Date.now() - asOf.getTime()) < 86_400_000) {
    const real = cachedHistory(symbol, range, asOf);
    if (real) return real;
  }

  if (range === "1D") return intradaySeries(symbol, asOf);

  let days: number;
  if (range === "ALL") days = ALL_DAYS - 1;
  else if (range === "YTD") {
    const jan1 = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
    days = Math.max(1, dayIndex(asOf) - dayIndex(jan1));
  } else days = RANGE_DAYS[range];

  const today = dayIndex(asOf);
  const closes = dailySeries(symbol, today);
  const points: PricePoint[] = [];
  // Downsample long ranges to <= 260 points to keep payloads small.
  const step = Math.max(1, Math.floor(days / 260));
  for (let back = days; back >= 0; back -= step) {
    const d = new Date(asOf.getTime() - back * 86_400_000);
    const idx = Math.min(closes.length - 1, Math.max(0, today - back - SERIES_ORIGIN));
    points.push({ t: d.toISOString().slice(0, 10), price: round2(closes[idx]) });
  }
  return points;
}

/** 5-minute bars for the current session, seeded per symbol+day. */
function intradaySeries(symbol: string, asOf: Date): PricePoint[] {
  const prevClose = closeAt(symbol, asOf, 1);
  const todayClose = closeAt(symbol, asOf, 0);
  const rand = mulberry32(hashString(`${symbol}:${dayIndex(asOf)}`));
  const bars = 78; // 6.5h session / 5min
  const points: PricePoint[] = [];
  let price = prevClose;
  const sessionStart = new Date(asOf);
  sessionStart.setUTCHours(14, 30, 0, 0); // 9:30 ET in UTC (approx)
  for (let i = 0; i < bars; i++) {
    const progress = (i + 1) / bars;
    // Random wiggle around a path that ends at today's close.
    const target = prevClose + (todayClose - prevClose) * progress;
    price = target * (1 + (rand() - 0.5) * 0.004);
    const t = new Date(sessionStart.getTime() + i * 5 * 60_000);
    points.push({ t: t.toISOString(), price: round2(price) });
  }
  points[points.length - 1].price = round2(todayClose);
  return points;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Return % change over a range, from history endpoints. */
export function rangeChangePct(symbol: string, range: Timeframe, asOf: Date = new Date()): number {
  const hist = getHistory(symbol, range, asOf);
  const first = hist[0].price;
  const last = hist[hist.length - 1].price;
  return round2(((last - first) / first) * 100);
}
