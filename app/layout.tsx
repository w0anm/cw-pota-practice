import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CW Parks on the Air Practice',
  description: 'Practice copying POTA calls with configurable CW speeds and Farnsworth spacing.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
