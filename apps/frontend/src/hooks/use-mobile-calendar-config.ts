'use client';

import { useCallback, useEffect, useState } from 'react';

export type CalendarView = 'month' | 'week';

const STORAGE_KEY = 'mobile-calendar-view';
const EVENT_NAME = 'mobile-calendar-view-change';

function readStored(): CalendarView {
  if (typeof window === 'undefined') return 'month';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'month' || saved === 'week') return saved;
  } catch {
    // ignore
  }
  return 'month';
}

export function useMobileCalendarConfig() {
  const [view, setViewState] = useState<CalendarView>('month');

  useEffect(() => {
    setViewState(readStored());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CalendarView>).detail;
      if (detail === 'month' || detail === 'week') setViewState(detail);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const setView = useCallback((v: CalendarView) => {
    setViewState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: v }));
    }
  }, []);

  return { view, setView };
}
