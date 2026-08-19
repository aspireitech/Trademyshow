import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import SocialButtons from "@/components/SocialButtons";
import ThemeToggle from "@/components/ThemeToggle";

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
      <div style={{ marginTop: 60 }}>
        <SocialButtons />
      </div>
      <Suspense fallback={<div className="card" style={{ maxWidth: 400, margin: "0 auto 60px", minHeight: 260 }} />}>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}
