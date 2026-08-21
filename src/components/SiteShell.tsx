import Link from "next/link";
import CookieNotice from "./CookieNotice";
import SiteHeader from "./SiteHeader";
import SiteSidebar from "./SiteSidebar";

/**
 * The frame every page sits in: left rail, header with search, content, footer.
 *
 * Having exactly one of these is the point. A layout that changes when you log
 * in, or when you open a stock, forces the visitor to re-learn where things
 * are at each step, and re-learning is indistinguishable from being lost.
 */
export default function SiteShell({
  children,
  active,
  wide = false,
}: {
  children: React.ReactNode;
  /** Which sidebar entry to mark as current. */
  active?: string;
  /** Screens that are mostly table: let them use the full width. */
  wide?: boolean;
}) {
  return (
    <div className="shell">
      <SiteSidebar active={active} />
      <div className={`shell-main${wide ? " wide" : ""}`}>
        <SiteHeader />
        <main className="shell-content">{children}</main>

        <footer className="site">
          <div className="shell-foot">
            <p>
              TradeMyShow provides analytics and educational content only. Nothing here is
              investment advice or a recommendation to buy or sell any security. Past
              performance does not predict future results.
            </p>
            <p className="dim">
              <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
              <Link href="/help">Help centre</Link> · <Link href="/track-record">Track record</Link>
            </p>
          </div>
        </footer>
        <CookieNotice />
      </div>
    </div>
  );
}
