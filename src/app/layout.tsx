import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { getActiveCompany, COMPANY_COOKIE } from '@/lib/company';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Fender Steel — Control Centre',
  description: 'Orders, production, stock, customers and CARES compliance for Fender Steel.',
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FenderBCS',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Signed in: the validated active company. Signed out (e.g. /login): fall
  // back to the raw cookie, purely cosmetic since there's no access to check yet.
  const active = user ? getActiveCompany(user) : (cookies().get(COMPANY_COOKIE)?.value ?? 'FENDER');

  return (
    <html lang="en-GB" className={inter.variable} data-brand={active === 'BS_SUPPLIES' ? 'bs-supplies' : undefined}>
      <body>{children}</body>
    </html>
  );
}
