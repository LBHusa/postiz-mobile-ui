'use client';

import type { FC } from 'react';
import { useState } from 'react';
import clsx from 'clsx';
import { usePlatformFormats } from '@gitroom/frontend/hooks/use-platform-formats';
import type { Integrations } from '@gitroom/frontend/components/launches/calendar.context';

interface PlatformCardProps {
  integration: Integrations;
  selected: boolean;
  format: string;
  onToggle: (id: string) => void;
  onFormatChange: (id: string, format: string) => void;
}

export const PlatformCard: FC<PlatformCardProps> = ({
  integration,
  selected,
  format,
  onToggle,
  onFormatChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const formats = usePlatformFormats(integration.identifier);

  return (
    <div
      data-testid="platform-card"
      data-integration-id={integration.id}
      className={clsx(
        'rounded-xl border transition-colors',
        selected ? 'border-btnPrimary bg-newBgColorInner' : 'border-newBorder bg-newBgColor'
      )}
    >
      {/* Card header row */}
      <div className="flex items-center gap-3 px-3 py-3">
        {/* Checkbox */}
        <button
          type="button"
          data-testid="platform-toggle"
          onClick={() => onToggle(integration.id)}
          className={clsx(
            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
            'active:opacity-60 transition-opacity',
            selected ? 'border-btnPrimary bg-btnPrimary' : 'border-newBorder bg-transparent'
          )}
        >
          {selected && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Logo + name */}
        <img
          src={integration.picture}
          alt={integration.name}
          width={20}
          height={20}
          className="rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-newTextColor truncate">{integration.name}</p>
          <p className="text-[10px] text-textItemBlur capitalize">{integration.identifier}</p>
        </div>

        {/* Expand toggle */}
        {selected && (
          <button
            type="button"
            data-testid="platform-expand"
            onClick={() => setExpanded((v) => !v)}
            className="p-1 text-textItemBlur active:opacity-60 transition-all"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={clsx('transition-transform', expanded && 'rotate-180')}
            >
              <polyline points="2 5 7 10 12 5" />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded settings */}
      {selected && expanded && (
        <div className="px-3 pb-3 border-t border-newBorder pt-3 flex flex-col gap-2">
          {/* Format picker */}
          {formats.formatOptions.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium text-textItemBlur uppercase tracking-wide">Format</span>
              <div className="flex flex-wrap gap-1.5">
                {formats.formatOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`format-option-${opt.value}`}
                    onClick={() => onFormatChange(integration.id, opt.value)}
                    className={clsx(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      format === opt.value
                        ? 'border-btnPrimary bg-btnPrimary text-white'
                        : 'border-newBorder bg-transparent text-textItemBlur'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Body variant indicator */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-textItemBlur">Body</span>
            <span className="text-xs text-newTextColor">identisch</span>
          </div>
        </div>
      )}
    </div>
  );
};
