import './globals.css';

export const metadata = {
  title: 'Progeni AutoApply Candidate Workspace',
  description: 'Manage your candidate profile, resume evidence, job matches, and application tracker.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
