/**
 * The logo: a mark plus the two-tone wordmark.
 *
 * The wordmark is the half-dark, half-blue lockup the owner picked — "Trade"
 * in the text colour, "MyShow" in the accent — kept because it already reads
 * as the brand. What it lacked was a mark: a wordmark alone cannot be a
 * favicon, an app icon, or an avatar, and those are the places a brand is
 * actually recognised.
 *
 * The mark is three ascending bars with the last breaking upward. Deliberately
 * not letters: "TMS" at 16 pixels is three grey smudges, whereas a shape
 * survives. It carries the same geometry as the sparklines on the board, so
 * the logo looks like it came from the same product as the data.
 */
export default function BrandMark({
  size = 26,
  withWord = true,
}: {
  size?: number;
  /** Mark only — for an avatar, a mobile header, or anywhere space is tight. */
  withWord?: boolean;
}) {
  return (
    <span className="brandmark">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        aria-hidden={withWord ? "true" : undefined}
        role={withWord ? undefined : "img"}
        aria-label={withWord ? undefined : "TradeMyShow"}
        className="brandmark-glyph"
      >
        <defs>
          <linearGradient id="brandmark-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#brandmark-grad)" />
        <rect x="6" y="18" width="4.5" height="8" rx="2.25" fill="#fff" opacity="0.55" />
        <rect x="13.75" y="13" width="4.5" height="13" rx="2.25" fill="#fff" opacity="0.8" />
        <rect x="21.5" y="8" width="4.5" height="18" rx="2.25" fill="#fff" />
        <path
          d="M20 6.5 L23.75 2.5 L27.5 6.5"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWord && (
        <span className="brandmark-word">
          Trade<span>MyShow</span>
        </span>
      )}
    </span>
  );
}
