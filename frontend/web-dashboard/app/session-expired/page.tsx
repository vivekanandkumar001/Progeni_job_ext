import Link from 'next/link';

export default function SessionExpiredPage() {
  return (
    <main className="consent-screen">
      <section className="consent-card" style={{ maxWidth: 520, textAlign: 'center' }}>
        <div className="brand-lockup" style={{ justifyContent: 'center' }}>
          <span className="brand-mark">P</span>
          <span>PROGENI <b>AUTOAPPLY</b></span>
        </div>
        <p className="eyebrow" style={{ color: '#d97706' }}>SESSION SECURITY NOTICE</p>
        <h1>Session Expired</h1>
        <p style={{ color: '#4b5563', lineHeight: 1.6 }}>
          Your session has expired or was terminated following a security event (such as a global logout or password reset). Please sign in again to continue.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link href="/login" className="button button-primary field-full" style={{ textAlign: 'center' }}>
            Sign In Again
          </Link>
        </div>
      </section>
    </main>
  );
}

