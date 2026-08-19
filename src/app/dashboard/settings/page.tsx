import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import SettingsPanel from "@/components/SettingsPanel";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <>
      <h2 style={{ marginBottom: 4 }}>Settings</h2>
      <p className="dim" style={{ fontSize: 14, marginBottom: 20 }}>
        Your account, security and email preferences.
      </p>
      <SettingsPanel
        name={user.name}
        email={user.email}
        plan={effectivePlan(user)}
        emailVerified={Boolean(user.emailVerifiedAt)}
        createdAt={user.createdAt}
      />
    </>
  );
}
