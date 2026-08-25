/**
 * Footer social row. Handles below are placeholders — swap for the real
 * accounts once they exist; a link to a handle nobody owns yet is worse than
 * no link, so update these before shipping to production.
 */
const LINKS: { name: string; href: string; path: string }[] = [
  {
    name: "X",
    href: "https://x.com/trademyshow",
    path: "M5 5l14 14M19 5L5 19",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/trademyshow",
    path:
      "M6 9h2.4v9H6V9zm1.2-4.2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM11 9h2.3v1.3h.03c.32-.58 1.1-1.3 2.3-1.3 2.45 0 2.9 1.5 2.9 3.5V18h-2.4v-4.5c0-1.07-.02-2.45-1.55-2.45-1.55 0-1.8 1.15-1.8 2.37V18H11V9z",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@trademyshow",
    path: "M21 8.3s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.5 5 12 5 12 5h0s-3.5 0-6.1.3c-.4 0-1.3.1-2.1.9-.6.6-.8 2.1-.8 2.1S3 10.1 3 11.9v1.2c0 1.8.2 3.6.2 3.6s.2 1.5.8 2.1c.8.8 1.8.8 2.3.9 1.7.2 7 .3 7.7.3s.3 0 0 0c.7 0 6-.1 7.7-.3.4 0 1.3-.1 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.8.2-3.6v-1.2c0-1.8-.2-3.6-.2-3.6zM10 15V8.8l5.4 3.1L10 15z",
  },
];

export default function SocialLinks() {
  return (
    <div className="social-links" aria-label="TradeMyShow on social media">
      {LINKS.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`TradeMyShow on ${l.name}`}
          title={l.name}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            {l.name === "X" ? (
              <path d={l.path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d={l.path} fill="currentColor" />
            )}
          </svg>
        </a>
      ))}
    </div>
  );
}
