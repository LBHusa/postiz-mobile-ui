import '../global.scss';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import clsx from 'clsx';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className={clsx(jakartaSans.className, 'dark !bg-primary text-primary')}>
        {children}
      </body>
    </html>
  );
}
