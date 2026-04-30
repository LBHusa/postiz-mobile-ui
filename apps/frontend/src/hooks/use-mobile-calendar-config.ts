'use client';

import { useCallback, useEffect, useState } from 'react';

export type CalendarView = 'month' | 'week';

const STORAGE_KEY = 'mobile-calendar-view';

export function useMobileCalendarConfig() {
  const [view, setViewState] = useState<CalendarView>('month');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'month' || saved === 'week') setViewState(saved);
    } catch {
      // localStorage unavailable (SSR / private mode)
    }
  }, []);

  const setView = useCallback((v: CalendarView) => {
    setViewState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  }, []);

  return { view, setView };
}
