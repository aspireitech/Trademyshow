import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import SocialButtons from "@/components/SocialButtons";
import ThemeToggle from "@/components/ThemeToggle";

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
      <div style={{ marginTop: 60 }}>
        <SocialButtons />
      </div>
      <Suspense fallback={<div className="card" style={{ maxWidth: 400, margin: "0 auto 60px", minHeight: 260 }} />}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
