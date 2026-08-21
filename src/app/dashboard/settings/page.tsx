import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import ProfileSection from "@/components/settings/ProfileSection";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <ProfileSection
      name={user.name}
      email={user.email}
      plan={effectivePlan(user)}
      emailVerified={Boolean(user.emailVerifiedAt)}
      createdAt={user.createdAt}
    />
  );
}
