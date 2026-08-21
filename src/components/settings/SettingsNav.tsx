"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The settings sidebar.
 *
 * Sections are ordered by how often they are needed, not by how they are
 * built: profile first, the destructive one last. Each carries a status dot
 * when something in it wants attention, so an unverified address or an
 * unprotected account is visible without opening every page to look.
 */
const SECTIONS = [
  { href: "/dashboard/settings", label: "Profile", hint: "Name, email, preferences" },
  { href: "/dashboard/settings/security", label: "Security", hint: "Passwords, 2FA, devices" },
  { href: "/dashboard/settings/billing", label: "Plan & billing", hint: "Tier, pause, referrals" },
  { href: "/dashboard/settings/activity", label: "Activity", hint: "Everything on this account" },
  { href: "/dashboard/settings/data", label: "Your data", hint: "Export, agreement, deletion" },
];

export default function SettingsNav({
  name,
  email,
  plan,
  emailVerified,
  twoFactor,
}: {
  name: string;
  email: string;
  plan: string;
  emailVerified: boolean;
  twoFactor: boolean;
}) {
  const pathname = usePathname();

  const attention: Record<string, string | null> = {
    "/dashboard/settings": emailVerified ? null : "Email not confirmed",
    "/dashboard/settings/security": twoFactor ? null : "Two-factor is off",
  };

  return (
    <nav className="settings-nav" aria-label="Settings sections">
      <div className="settings-id">
        <span className="settings-avatar" aria-hidden="true">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="settings-id-text">
          <strong>{name}</strong>
          <span className="dim">{email}</span>
          <span className={`badge ${plan !== "free" ? "pro" : ""}`}>{plan}</span>
        </span>
      </div>

      <ul>
        {SECTIONS.map((s) => {
          // Exact match for the index route, prefix match for the rest, so
          // /security does not also light up Profile.
          const active =
            s.href === "/dashboard/settings"
              ? pathname === s.href
              : pathname.startsWith(s.href);
          const flag = attention[s.href];
          return (
            <li key={s.href}>
              <Link href={s.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                <span className="settings-link-label">
                  {s.label}
                  {flag && <span className="settings-flag" title={flag} aria-label={flag} />}
                </span>
                <span className="settings-link-hint">{flag ?? s.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
