import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import '../global.scss';

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
      <body className="dark">
        {children}
      </body>
    </html>
  );
}
