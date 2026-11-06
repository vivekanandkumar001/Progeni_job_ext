import Link from 'next/link';

export default function AdminUnauthorizedPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: '1rem' }}>
      <section style={{ maxWidth: 440, width: '100%', background: '#ffffff', border: '1px solid #fee2e2', borderRadius: 12, padding: '2rem', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🛡️</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b', marginTop: '0.5rem' }}>
            403 Forbidden: Administrator Access Required
          </h1>
        </div>
        <p style={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          This console is strictly restricted to authorized system administrators and platform operators. Your credentials do not hold the required administrative privileges.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: '#111827',
            color: '#ffffff',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          Sign In with Admin Credentials
        </Link>
      </section>
    </main>
  );
}

