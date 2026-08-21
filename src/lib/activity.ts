import { getDb } from "./db";

/**
 * The account activity feed.
 *
 * The audit table stores machine-readable action codes. This turns them into
 * sentences a person can act on, because the point of showing someone their
 * own security history is that they recognise the entry they did not make.
 * "password_reset.completed" tells them nothing; "Password changed" does.
 *
 * Unknown codes fall through to a readable form rather than being hidden — a
 * feed that silently omits what it does not recognise is worse than one that
 * shows a rough label.
 */

export type ActivityKind = "security" | "billing" | "account" | "data";

interface Descriptor {
  label: string;
  kind: ActivityKind;
  /** True where the entry is worth a second look if unexpected. */
  notable?: boolean;
}

const DESCRIPTORS: Record<string, Descriptor> = {
  "account.created": { label: "Account created", kind: "account" },
  "account.created.oauth": { label: "Account created with a social login", kind: "account" },
  "account.exported": { label: "Data export downloaded", kind: "data", notable: true },
  "account.deleted": { label: "Account deletion requested", kind: "account", notable: true },
  "login.success": { label: "Signed in", kind: "security" },
  "login.failed": { label: "Failed sign-in attempt", kind: "security", notable: true },
  "login.oauth": { label: "Signed in with a social login", kind: "security" },
  "logout": { label: "Signed out", kind: "security" },
  "password_reset.requested": { label: "Password reset requested", kind: "security", notable: true },
  "password_reset.completed": { label: "Password changed", kind: "security", notable: true },
  "email_verification.sent": { label: "Verification email sent", kind: "account" },
  "email_verification.confirmed": { label: "Email address confirmed", kind: "account" },
  "totp.enabled": { label: "Two-factor authentication turned on", kind: "security", notable: true },
  "totp.disabled": { label: "Two-factor authentication turned off", kind: "security", notable: true },
  "phone.verified": { label: "Mobile number verified", kind: "security", notable: true },
  "phone.removed": { label: "Mobile number removed", kind: "security", notable: true },
  "security_questions.set": { label: "Security questions updated", kind: "security", notable: true },
  "session.revoked": { label: "A signed-in device was signed out", kind: "security", notable: true },
  "sessions.revoked_all": { label: "Signed out of all other devices", kind: "security", notable: true },
  "preferences.updated": { label: "Email preferences changed", kind: "account" },
  "contract.downloaded": { label: "Agreement PDF downloaded", kind: "data" },
  "billing.checkout_started": { label: "Checkout started", kind: "billing" },
  "billing.plan_changed": { label: "Plan changed", kind: "billing", notable: true },
  "billing.paused": { label: "Subscription paused", kind: "billing", notable: true },
  "billing.resumed": { label: "Subscription resumed", kind: "billing", notable: true },
  "oauth.bad_state": { label: "A social sign-in was rejected", kind: "security", notable: true },
  "oauth.unverified_email": { label: "A social sign-in with an unverified address was rejected", kind: "security", notable: true },
};

export interface ActivityEntry {
  id: number;
  action: string;
  label: string;
  kind: ActivityKind;
  notable: boolean;
  detail: string | null;
  createdAt: string;
}

function describe(action: string): Descriptor {
  const known = DESCRIPTORS[action];
  if (known) return known;
  // e.g. "billing.refund_issued" -> "Billing: refund issued"
  const [head, ...rest] = action.split(".");
  const tail = rest.join(" ").replace(/_/g, " ");
  const label = tail ? `${head.replace(/_/g, " ")}: ${tail}` : action.replace(/_/g, " ");
  return { label: label.charAt(0).toUpperCase() + label.slice(1), kind: "account" };
}

export interface ActivityPage {
  entries: ActivityEntry[];
  total: number;
}

export function userActivity(
  userId: number,
  opts: { limit?: number; offset?: number; kind?: ActivityKind } = {},
): ActivityPage {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const db = getDb();

  const rows = db
    .prepare(
      "SELECT id, action, detail, created_at FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
    )
    .all(userId, limit, offset) as {
    id: number; action: string; detail: string | null; created_at: string;
  }[];

  const total = (
    db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE user_id = ?").get(userId) as { n: number }
  ).n;

  let entries = rows.map((r) => {
    const d = describe(r.action);
    return {
      id: r.id,
      action: r.action,
      label: d.label,
      kind: d.kind,
      notable: Boolean(d.notable),
      detail: r.detail,
      createdAt: r.created_at,
    };
  });

  if (opts.kind) entries = entries.filter((e) => e.kind === opts.kind);
  return { entries, total };
}
