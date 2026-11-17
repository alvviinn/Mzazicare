import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

// The app's two families, served from this site (no request to a font service).
// Bricolage Grotesque for display and headings, Atkinson Hyperlegible Next for everything you read.
const bricolage = localFont({
  src: [
    { path: '../fonts/BricolageGrotesque_600SemiBold.ttf', weight: '600' },
    { path: '../fonts/BricolageGrotesque_700Bold.ttf', weight: '700' },
  ],
  variable: '--font-bricolage',
  display: 'swap',
});
const atkinson = localFont({
  src: [
    { path: '../fonts/AtkinsonHyperlegibleNext_400Regular.ttf', weight: '400' },
    { path: '../fonts/AtkinsonHyperlegibleNext_700Bold.ttf', weight: '700' },
  ],
  variable: '--font-atkinson',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MzaziCare',
  description: 'Family dashboard for elderly care: verified caretaker visits, tasks with photo proof, medicines, voice tone, emergencies and chat.',
};

// the browser bar matches --background (a meta tag value, so it cannot read the CSS variable)
export const viewport: Viewport = { themeColor: '#F7FAFD', colorScheme: 'light' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${atkinson.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
