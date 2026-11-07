import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export default function AdminUnauthorizedPage() {
  return (
    <main className="auth-screen">
      <section className="standalone-card animate-rise">
        <span className="standalone-icon" aria-hidden>
          <ShieldAlert size={27} strokeWidth={1.9} />
        </span>
        <p className="eyebrow" style={{ marginTop: 16 }}>
          403 · Forbidden
        </p>
        <h1>Administrator access required</h1>
        <p>
          This console is strictly restricted to authorized system administrators and platform
          operators. Your credentials do not hold the required administrative privileges.
        </p>
        <Link href="/login" className="button button-primary">
          <ArrowLeft size={15} />
          Sign in with admin credentials
        </Link>
      </section>
    </main>
  );
}
