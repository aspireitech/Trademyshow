import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ResetPasswordForm from "@/components/ResetPasswordForm";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="container">
      <nav className="nav">
        <Link href="/" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <ThemeToggle />
          <Link href="/login">Log in</Link>
        </div>
      </nav>
      <Suspense fallback={<p className="dim" style={{ textAlign: "center", marginTop: 60 }}>Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
