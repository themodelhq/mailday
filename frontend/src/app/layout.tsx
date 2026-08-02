import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppProviders from '@/providers/AppProviders';

export const metadata: Metadata = {
  title: 'MailDay — AI-Powered Email',
  description:
    'Enterprise AI-powered email platform. Fast, secure, offline-ready. Comparable to leading webmail services, with intelligent productivity built in.',
  manifest: '/manifest.webmanifest',
  applicationName: 'MailDay',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MailDay' },
};

export const viewport: Viewport = {
  themeColor: '#3366ff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const noFlashTheme = `(function(){try{var t=localStorage.getItem('md_theme')||'dark';var e=document.documentElement;if(t==='dark')e.classList.add('dark');if(t==='amoled')e.classList.add('dark','amoled');}catch(_){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
