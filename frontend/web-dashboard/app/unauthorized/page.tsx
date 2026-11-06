import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="consent-screen">
      <section className="consent-card" style={{ maxWidth: 520, textAlign: 'center' }}>
        <div className="brand-lockup" style={{ justifyContent: 'center' }}>
          <span className="brand-mark">P</span>
          <span>PROGENI <b>AUTOAPPLY</b></span>
        </div>
        <p className="eyebrow" style={{ color: 'rgb(var(--danger))' }}>ACCESS RESTRICTED (HTTP 403)</p>
        <h1>Unauthorized Access</h1>
        <p style={{ color: 'rgb(var(--on-surface-variant))', lineHeight: 1.6 }}>
          You do not have the required role or permissions to view this resource. If you believe this is an error, please contact your workspace administrator.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="button button-primary">
            Return to Dashboard
          </Link>
          <Link href="/login" className="button button-secondary">
            Sign In with Another Account
          </Link>
        </div>
      </section>
    </main>
  );
}
