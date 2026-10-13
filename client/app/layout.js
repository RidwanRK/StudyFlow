import { Fredoka, Nunito } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-heading', display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata = {
  title: 'StudyFlow',
  description: 'An AI study planner that replans with you when a day goes sideways.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
