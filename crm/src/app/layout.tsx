import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { APP_NAME } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Live CRM and analytics for universities and recruitment agencies managing EU / Schengen visa cases.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f7f8fb' }, { media: '(prefers-color-scheme: dark)', color: '#10131c' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
