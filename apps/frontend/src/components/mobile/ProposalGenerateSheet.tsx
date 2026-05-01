'use client';

import type { FC } from 'react';
import { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';

interface GenerateOptions {
  avoidExisting: boolean;
  ensureDiversity: boolean;
  preferUnusedPillars: boolean;
}

interface ProposalGenerateSheetProps {
  onGenerate: (weeksAhead: number, options: GenerateOptions) => void;
  onClose: () => void;
  isLoading?: boolean;
}

const WEEKS_OPTIONS = [1, 2, 4] as const;

export const ProposalGenerateSheet: FC<ProposalGenerateSheetProps> = ({
  onGenerate,
  onClose,
  isLoading = false,
}) => {
  const [weeksAhead, setWeeksAhead] = useState<number>(1);
  const [options, setOptions] = useState<GenerateOptions>({
    avoidExisting: true,
    ensureDiversity: true,
    preferUnusedPillars: true,
  });

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const toggleOption = useCallback((key: keyof GenerateOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleGenerate = useCallback(() => {
    if (isLoading) return;
    onGenerate(weeksAhead, options);
  }, [weeksAhead, options, onGenerate, isLoading]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleBackdropClick}
    >
      <div
        data-testid="proposal-generate-sheet"
        className="w-full rounded-t-2xl bg-newBgColor border-t border-newBorder flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-newSep" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-newBorder flex items-center justify-between">
          <h2 className="text-base font-semibold text-newTextColor">Vorschläge generieren</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-textItemBlur active:opacity-60 transition-opacity p-1"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="15" y2="15" />
              <line x1="15" y1="3" x2="3" y2="15" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-5">
          {/* Weeks selector */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-textItemBlur uppercase tracking-wide">
              Zeitraum
            </span>
            <div className="flex gap-2">
              {WEEKS_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  data-testid={`weeks-option-${w}`}
                  data-selected={weeksAhead === w ? 'true' : 'false'}
                  onClick={() => setWeeksAhead(w)}
                  className={clsx(
                    'flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors',
                    weeksAhead === w
                      ? 'border-btnPrimary bg-btnPrimary text-white'
                      : 'border-newBorder bg-newBgColorInner text-newTextColor active:opacity-60'
                  )}
                >
                  {w} {w === 1 ? 'Woche' : 'Wochen'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-textItemBlur">
              ≈ {weeksAhead * 4} Vorschläge werden generiert
            </p>
          </div>

          {/* Options toggles */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-textItemBlur uppercase tracking-wide mb-1">
              Optionen
            </span>

            {(
              [
                { key: 'avoidExisting', label: 'Bestehende Posts berücksichtigen', desc: 'Keine Duplikate zu bereits geplanten Posts' },
                { key: 'ensureDiversity', label: 'Plattform-Diversität sicherstellen', desc: 'Mix aus verschiedenen Content-Typen' },
                { key: 'preferUnusedPillars', label: 'Ungenutzte Säulen bevorzugen', desc: 'Content-Strategie gleichmäßig bedienen' },
              ] as { key: keyof GenerateOptions; label: string; desc: string }[]
            ).map(({ key, label, desc }) => (
              <button
                key={key}
                type="button"
                data-testid={`option-${key}`}
                data-checked={options[key] ? 'true' : 'false'}
                onClick={() => toggleOption(key)}
                className="flex items-start gap-3 py-3 border-b border-newBorder last:border-0 active:opacity-60 transition-opacity text-left"
              >
                <span
                  className={clsx(
                    'flex-shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-colors',
                    options[key]
                      ? 'bg-btnPrimary border-btnPrimary text-white'
                      : 'border-newBorder bg-newBgColorInner'
                  )}
                >
                  {options[key] && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  )}
                </span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-newTextColor">{label}</span>
                  <span className="text-[11px] text-textItemBlur leading-snug">{desc}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Generate button */}
          <button
            type="button"
            data-testid="proposal-generate-submit"
            onClick={handleGenerate}
            disabled={isLoading}
            className={clsx(
              'w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity',
              'bg-btnPrimary',
              isLoading ? 'opacity-50' : 'active:opacity-80'
            )}
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            {isLoading ? 'Generiere…' : `${weeksAhead * 4} Vorschläge generieren`}
          </button>
        </div>
      </div>
    </div>
  );
};
