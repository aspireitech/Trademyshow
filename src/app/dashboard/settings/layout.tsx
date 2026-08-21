import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { effectivePlan, isTrialing } from "@/lib/plans";
import SettingsNav from "@/components/settings/SettingsNav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <>
      <p style={{ marginBottom: 8 }}>
        <Link href="/dashboard" className="dim">
          ← Dashboard
        </Link>
      </p>
      <div className="settings-shell">
        <SettingsNav
          name={user.name}
          email={user.email}
          plan={isTrialing(user) ? "Pro trial" : effectivePlan(user)}
          emailVerified={Boolean(user.emailVerifiedAt)}
          twoFactor={Boolean(user.totpEnabledAt)}
        />
        <div className="settings-content">{children}</div>
      </div>
    </>
  );
}
