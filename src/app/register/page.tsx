import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import ThemeToggle from "@/components/ThemeToggle";
import { enabledProviders } from "@/lib/oauth";

export default function RegisterPage() {
  return (
    <div className="container">
      <nav className="nav">
        <Link href="/" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <ThemeToggle />
          <Link href="/login">Have an account? Log in</Link>
        </div>
      </nav>
      <Suspense fallback={<div className="card" style={{ maxWidth: 420, margin: "60px auto", minHeight: 300 }} />}>
        <AuthForm mode="register" providers={enabledProviders()} />
      </Suspense>
    </div>
  );
}
