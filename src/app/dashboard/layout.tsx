import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import SiteShell from "@/components/SiteShell";

/**
 * The signed-in area sits in exactly the same frame as everything else.
 *
 * It used to have its own centred container and its own navigation bar, so
 * logging in visibly threw away the market dashboard the visitor had just been
 * using — sidebar gone, search gone, layout different. Same shell, same
 * header, same search box: signing in adds their watchlists to what they were
 * already looking at instead of replacing it.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return <SiteShell active="dashboard">{children}</SiteShell>;
}
