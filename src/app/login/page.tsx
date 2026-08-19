import Link from "next/link";
import AuthForm from "@/components/AuthForm";
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
      <AuthForm mode="login" />
    </div>
  );
}
