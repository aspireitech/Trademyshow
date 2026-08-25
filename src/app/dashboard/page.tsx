import Link from "next/link";
import GroupsPanel from "@/components/GroupsPanel";
import MarketsDashboard from "@/components/MarketsDashboard";
import { currentUser } from "@/lib/auth";
import { listGroups } from "@/lib/db";

/**
 * The signed-in dashboard: their lists first, the market board underneath.
 *
 * The market board is here on purpose. It is the same board as the home page,
 * and repeating it is not duplication — someone who signs in should not lose
 * the thing they were reading a moment ago. Their watchlists sit above it
 * because that is the part only they have.
 */
export default async function DashboardPage() {
  const user = await currentUser();
  const groups = user ? listGroups(user.id) : [];

  return (
    <>
      <div className="board-intro">
        <div>
          <h1>Your dashboard</h1>
          <p className="dim">
            {groups.length === 0
              ? "Add a stock to a watchlist and tomorrow's insight is built on it. Use the search box above, then press Watchlist on any stock."
              : `${groups.length} watchlist${groups.length === 1 ? "" : "s"} — what moved, by how much, and why.`}
          </p>
        </div>
      </div>

      <GroupsPanel />

      <section style={{ marginTop: 30 }}>
        <div className="board-intro">
          <div>
            <h2>Markets today</h2>
            <p className="dim">
              The same board as the home page. <Link href="/">See every screen →</Link>
            </p>
          </div>
        </div>
        <MarketsDashboard view="gainers" />
      </section>
    </>
  );
}
