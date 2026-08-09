import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="container">
      <nav className="nav">
        <Link href="/" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <Link href="/register">Need an account? Sign up</Link>
        </div>
      </nav>
      <AuthForm mode="login" />
    </div>
  );
}
