'use client';

import type { FC } from 'react';
import clsx from 'clsx';
import { useStatusMapping } from '@gitroom/frontend/hooks/use-status-mapping';
import { useStatusStates } from '@gitroom/frontend/hooks/use-platform-formats';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';

interface StatusPickerProps {
  current: MobileStatus;
  onSelect: (status: MobileStatus) => void;
  onClose: () => void;
}

export const StatusPicker: FC<StatusPickerProps> = ({ current, onSelect, onClose }) => {
  const states = useStatusStates();
  const { getConfig } = useStatusMapping();

  return (
    <div
      data-testid="status-picker"
      className="fixed inset-0 z-[110] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-t-2xl bg-newBgColor border-t border-newBorder animate-normalFadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-newSep" />
        </div>

        <div className="px-4 py-3 border-b border-newBorder">
          <h2 className="text-base font-semibold text-newTextColor">Status</h2>
        </div>

        <div
          className="flex flex-col pb-6"
          style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
        >
          {states.map((s) => {
            const config = getConfig(s.value as MobileStatus);
            const isSelected = current === s.value;
            return (
              <button
                key={s.value}
                type="button"
                data-testid={`status-option-${s.value}`}
                onClick={() => { onSelect(s.value as MobileStatus); onClose(); }}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3.5',
                  'border-b border-newBorder last:border-0',
                  'active:opacity-60 transition-opacity',
                  isSelected && 'bg-newBgColorInner'
                )}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <span className={clsx(
                  'text-sm font-medium',
                  isSelected ? 'text-newTextColor' : 'text-textItemBlur'
                )}>
                  {config.label}
                </span>
                {isSelected && (
                  <span className="ml-auto text-btnPrimary text-xs">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
