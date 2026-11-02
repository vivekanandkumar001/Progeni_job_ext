import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Progeni AutoApply',
  description: 'How Progeni AutoApply handles account, profile, and job-workspace data.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="consent-screen">
      <article className="consent-card">
        <div className="brand-lockup">
          <span className="brand-mark">P</span>
          <span>PROGENI <b>AUTOAPPLY</b></span>
        </div>
        <p className="eyebrow">PRIVACY</p>
        <h1>Privacy policy</h1>
        <p>Last updated: November 2, 2026</p>
        <h2>Information we process</h2>
        <p>
          Progeni processes your email through Supabase authentication. If you choose
          to use the candidate workspace, it stores the profile fields, job details,
          match explanations, resume-derived evidence you review and save, privacy
          consent timestamp, and application tracker entries you provide.
        </p>
        <h2>Job pages and resumes</h2>
        <p>
          The browser extension reads supported job-page information only after you
          select a detection action. The detected information is sent to the Progeni
          API when you request a match or save it. A resume you select is sent to the
          API for parsing; Progeni stores only the reviewed details you save, not the
          original file or full extracted text.
        </p>
        <h2>Use and sharing</h2>
        <p>
          Workspace information is used to provide your profile, resume review, job-fit
          explanations, and tracker. Progeni does not submit applications, send your
          information to job sites, or send it to an AI provider. Account authentication
          is provided by Supabase and workspace records are stored in MongoDB.
        </p>
        <h2>Retention and deletion</h2>
        <p>
          You can remove your workspace records from the Privacy &amp; data section
          while signed in. That clears your profile, resume-derived details, saved jobs,
          matches, consent record, and tracker. It does not currently delete your
          Supabase account. To remove an account, contact the service operator through
          the contact information provided with the Chrome Web Store listing.
        </p>
        <h2>Security and contact</h2>
        <p>
          Data is transmitted over HTTPS in production and associated with the
          authenticated account. No online service can guarantee absolute security.
          For privacy questions or account deletion requests, use the contact
          information published on the Chrome Web Store listing.
        </p>
        <p><Link href="/dashboard">Return to the candidate workspace</Link></p>
      </article>
    </main>
  );
}
