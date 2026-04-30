'use client';

import type { FC } from 'react';
import { useCallback, useState } from 'react';
import clsx from 'clsx';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

interface DateTimePickerProps {
  value: string; // ISO string
  onConfirm: (iso: string) => void;
  onClose: () => void;
}

export const DateTimePicker: FC<DateTimePickerProps> = ({ value, onConfirm, onClose }) => {
  const parsed = newDayjs(value);
  const [date, setDate] = useState(parsed.format('YYYY-MM-DD'));
  const [time, setTime] = useState(parsed.format('HH:mm'));

  const handleConfirm = useCallback(() => {
    const iso = newDayjs(`${date}T${time}`).toISOString();
    onConfirm(iso);
    onClose();
  }, [date, time, onConfirm, onClose]);

  return (
    <div
      data-testid="datetime-picker"
      className="fixed inset-0 z-[110] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-t-2xl bg-newBgColor border-t border-newBorder flex flex-col animate-normalFadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-newSep" />
        </div>

        <div className="px-4 py-3 border-b border-newBorder flex items-center justify-between">
          <h2 className="text-base font-semibold text-newTextColor">Datum &amp; Uhrzeit</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-textItemBlur text-sm active:opacity-60"
          >
            Abbrechen
          </button>
        </div>

        <div className="px-4 py-6 flex flex-col gap-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-textItemBlur uppercase tracking-wide">Datum</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={clsx(
                'w-full rounded-lg border border-newBorder bg-newBgColorInner',
                'px-3 py-2.5 text-sm text-newTextColor outline-none',
                'focus:border-btnPrimary transition-colors'
              )}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-textItemBlur uppercase tracking-wide">Uhrzeit</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={clsx(
                'w-full rounded-lg border border-newBorder bg-newBgColorInner',
                'px-3 py-2.5 text-sm text-newTextColor outline-none',
                'focus:border-btnPrimary transition-colors'
              )}
            />
          </label>
        </div>

        <div className="px-4 pb-6" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            data-testid="datetime-confirm"
            onClick={handleConfirm}
            className="w-full rounded-lg bg-btnPrimary text-white py-3 text-sm font-semibold active:opacity-80 transition-opacity"
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
};
