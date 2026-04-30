'use client';

import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { useRegenState } from '@gitroom/frontend/hooks/use-regen-state';

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
  const { regen, setRegenDone } = useRegenState();

  return (
    <div className="flex min-h-screen flex-col bg-newBgColor text-textColor">
      {/* KI-Visual-Top-Bar-Banner */}
      <div id="ki-banner-slot">
        {regen.active && (
          <div
            data-testid="ki-banner"
            className="w-full bg-btnPrimary px-4 py-2 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="animate-pulse text-base">🤖</span>
              <span className="text-white text-xs font-medium truncate">
                KI arbeitet — Body+Bild...
              </span>
            </div>
            <button
              type="button"
              data-testid="ki-banner-cancel"
              onClick={setRegenDone}
              className="text-white text-xs opacity-70 active:opacity-100 flex-shrink-0"
            >
              Abbrechen
            </button>
          </div>
        )}
      </div>

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
