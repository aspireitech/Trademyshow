import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { visitorStats } from "@/lib/visitors";

/**
 * The traffic line in the footer — admin only.
 *
 * The gate is the whole point, so it is a server-side check rather than a CSS
 * class or a client-side condition: for anyone who is not an administrator
 * these numbers are never rendered, never sent to the browser, and not present
 * in the HTML to be found with view-source. Hiding them in the client would
 * mean publishing everyone's traffic to everyone.
 *
 * It lives in the footer rather than only on the admin dashboard because that
 * is where the operator actually sees it: every page, without going to look.
 */
export default async function AdminFooterStats() {
  const user = await currentUser();
  if (user?.role !== "admin") return null;

  let stats;
  try {
    stats = visitorStats();
  } catch {
    // A counter is never worth taking a page down for.
    return null;
  }

  const perVisit = stats.uniqueVisitorDays
    ? (stats.totalViews / stats.uniqueVisitorDays).toFixed(1)
    : "0";

  return (
    <div className="admin-footer" aria-label="Visitor counters (administrators only)">
      <span className="admin-footer-tag">Admin only</span>

      <dl>
        <div title="Every page view ever recorded, counted server-side so ad blockers do not distort it.">
          <dt>Total views</dt>
          <dd className="mono">{stats.totalViews.toLocaleString()}</dd>
        </div>
        <div title="Distinct visitors, all time. The identifying hash is re-salted every day so it cannot be linked across days — which means one person visiting on three days counts as three visitor-days here. It is deliberately not called 'unique visitors'.">
          <dt>Visitor-days</dt>
          <dd className="mono">{stats.uniqueVisitorDays.toLocaleString()}</dd>
        </div>
        <div title="Visitor-days with more than one page view — somebody who kept reading rather than bouncing.">
          <dt>Repeat</dt>
          <dd className="mono">{stats.repeatVisitorDays.toLocaleString()}</dd>
        </div>
        <div title="Distinct visitors seen today. Within a single day the hash is stable, so this one really is unique people.">
          <dt>Unique today</dt>
          <dd className="mono">{stats.uniqueToday.toLocaleString()}</dd>
        </div>
        <div title="Of today's visitors, how many viewed more than one page.">
          <dt>Returned today</dt>
          <dd className="mono">{stats.returningToday.toLocaleString()}</dd>
        </div>
        <div title="Total views divided by visitor-days. Under about 2 means people are landing and leaving.">
          <dt>Views / visit</dt>
          <dd className="mono">{perVisit}</dd>
        </div>
      </dl>

      <Link href="/dashboard/admin" className="admin-footer-more">
        Full admin →
      </Link>
    </div>
  );
}
