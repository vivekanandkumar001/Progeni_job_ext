import type { Metadata, Viewport } from 'next';
import AdminShell from '../components/AdminShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Progeni Admin Console',
  description: 'Revenue, usage, identity and compliance operations for the Progeni platform.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fc' },
    { media: '(prefers-color-scheme: dark)', color: '#090b12' },
  ],
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('progeni.admin-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
