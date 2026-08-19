import Link from "next/link";
import AuthForm from "@/components/AuthForm";
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
      <AuthForm mode="register" />
    </div>
  );
}
