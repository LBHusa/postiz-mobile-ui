import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface MobileShellProps {
  children: ReactNode;
  title?: string;
}

export function MobileShell({ children, title }: MobileShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-newBgColor text-textColor">
      {/* KI-Visual-Top-Bar-Banner-Slot — populated in Phase 5 */}
      <div id="ki-banner-slot" />

      <header className="flex h-14 items-center border-b border-newBorder px-4">
        {title && (
          <h1 className="text-base font-semibold text-newTextColor">{title}</h1>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-16">{children}</main>

      <BottomNav />
    </div>
  );
}
