import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listGroups } from "@/lib/db";
import type { MoverView } from "@/lib/insight/movers";

/**
 * The left rail every research site trains people to expect. Server-rendered:
 * for a signed-in visitor it lists their actual watchlists, so "my lists" are
 * one click from any market screen.
 */
const MARKET_LINKS: { view: MoverView; label: string }[] = [
  { view: "gainers", label: "Top gainers" },
  { view: "losers", label: "Top losers" },
  { view: "active", label: "Biggest moves" },
  { view: "high52", label: "52-week highs" },
  { view: "low52", label: "52-week lows" },
];

export default async function SiteSidebar({ active }: { active?: string }) {
  const user = await currentUser();
  const groups = user ? listGroups(user.id) : [];

  const item = (href: string, label: string, key: string) => (
    <li key={key}>
      <Link href={href} className={active === key ? "active" : ""}
        aria-current={active === key ? "page" : undefined}>
        {label}
      </Link>
    </li>
  );

  return (
    <aside className="side-nav" aria-label="Site sections">
      <ul>
        {item("/", "Home", "home")}
        {user
          ? item("/dashboard", "Dashboard", "dashboard")
          : item("/register", "Start free", "register")}
      </ul>

      <p className="side-label">Markets</p>
      <ul>
        {MARKET_LINKS.map((m) => item(`/markets/${m.view}`, m.label, m.view))}
        {item(user ? "/dashboard/compare" : "/register", "Compare", "compare")}
      </ul>

      {user && groups.length > 0 && (
        <>
          <p className="side-label">My watchlists</p>
          <ul>
            {groups.slice(0, 8).map((g) =>
              item(`/dashboard/groups/${g.id}`, g.name, `group-${g.id}`),
            )}
          </ul>
        </>
      )}

      <p className="side-label">Company</p>
      <ul>
        {item("/track-record", "Track record", "track-record")}
        {item("/pricing", "Pricing", "pricing")}
        {item("/help", "Help centre", "help")}
      </ul>
    </aside>
  );
}
