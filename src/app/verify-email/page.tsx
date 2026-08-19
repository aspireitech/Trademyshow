import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import VerifyEmailPanel from "@/components/VerifyEmailPanel";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <div className="container">
      <nav className="nav">
        <Link href="/" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <ThemeToggle />
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>
      <Suspense fallback={<p className="dim" style={{ textAlign: "center", marginTop: 60 }}>Loading…</p>}>
        <VerifyEmailPanel />
      </Suspense>
    </div>
  );
}
