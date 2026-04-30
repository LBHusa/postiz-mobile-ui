import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface MobileShellProps {
  children: ReactNode;
  title?: string;
  headerRight?: ReactNode;
  badgeCount?: number;
}

export function MobileShell({
  children,
  title,
  headerRight,
  badgeCount = 0,
}: MobileShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-newBgColor text-textColor">
      {/* KI-Visual-Top-Bar-Banner-Slot — populated in Phase 5 */}
      <div id="ki-banner-slot" />

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-newBorder bg-newBgColor px-4">
        {title ? (
          <h1 className="text-base font-semibold text-newTextColor">{title}</h1>
        ) : (
          <span />
        )}
        {headerRight && <div className="flex items-center">{headerRight}</div>}
      </header>

      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      <BottomNav badgeCount={badgeCount} />
    </div>
  );
}
