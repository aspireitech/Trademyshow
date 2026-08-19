import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import ThemeToggle from "@/components/ThemeToggle";
import { enabledProviders } from "@/lib/oauth";

export default function LoginPage() {
  return (
    <div className="container">
      <nav className="nav">
        <Link href="/" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <ThemeToggle />
          <Link href="/register">Need an account? Sign up</Link>
        </div>
      </nav>
      <Suspense fallback={<div className="card" style={{ maxWidth: 420, margin: "60px auto", minHeight: 300 }} />}>
        <AuthForm mode="login" providers={enabledProviders()} />
      </Suspense>
    </div>
  );
}
