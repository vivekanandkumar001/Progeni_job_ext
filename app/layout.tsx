import './globals.css';
import { ThemeProvider, themeInitScript } from '../components/ThemeProvider';

export const metadata = {
  title: 'Progeni AutoApply Candidate Workspace',
  description: 'Manage your candidate profile, resume evidence, job matches, and application tracker.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
