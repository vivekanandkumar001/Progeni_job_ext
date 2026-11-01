import './globals.css';

export const metadata = {
  title: 'Progeni AutoApply',
  description: 'Career OS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
