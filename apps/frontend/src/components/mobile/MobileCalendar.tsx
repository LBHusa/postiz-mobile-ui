'use client';

import { useCallback, useState } from 'react';
import clsx from 'clsx';
import { CalendarWeekProvider, useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { useMobileCalendarConfig } from '@gitroom/frontend/hooks/use-mobile-calendar-config';
import { useMobileProposals } from '@gitroom/frontend/hooks/use-mobile-proposals';
import { MobileCalendarMonth } from './MobileCalendarMonth';
import { MobileCalendarWeek } from './MobileCalendarWeek';
import { DaySheet } from './DaySheet';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { useToaster } from '@gitroom/react/toaster/toaster';

// Inner component that consumes the CalendarContext
function CalendarInner() {
  const { posts, integrations, startDate, loading } = useCalendar();
  const { proposals } = useMobileProposals();
  const { view } = useMobileCalendarConfig();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const toaster = useToaster();

  const postsMapped = posts.map((p) => ({
    id: p.id,
    publishDate: new Date(p.publishDate).toISOString(),
    state: p.state,
    // content is stored as stringified JSON array in the Postiz schema
    content: Array.isArray((p as any).content)
      ? (p as any).content[0]?.value || ''
      : ((p as any).content ?? ''),
    integration: { id: p.integration.id },
  }));

  // Posts for the selected day's sheet
  const selectedDayPosts = selectedDate
    ? postsMapped.filter(
        (p) => newDayjs(p.publishDate).format('YYYY-MM-DD') === selectedDate
      )
    : [];

  // Proposals for the selected day
  const selectedDayProposals = selectedDate
    ? proposals.filter((pr) => pr.date === selectedDate).map((pr) => ({
        id: pr.id,
        publishDate: `${pr.date}T${pr.time}:00`,
        content: pr.title,
        state: 'PROPOSAL',
        integration: { id: '' },
        isProposal: true as const,
      }))
    : [];

  const allSheetPosts = [...selectedDayPosts, ...selectedDayProposals].sort(
    (a, b) => new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime()
  );

  const handlePostPress = useCallback(
    (_id: string) => {
      toaster.show('Detail-Ansicht kommt in Phase 3', 'warning');
    },
    [toaster]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {loading && (
        <div className="flex justify-center items-center py-8">
          <span className="text-xs text-textItemBlur">Laden…</span>
        </div>
      )}

      {!loading && view === 'month' && (
        <div className="px-2 py-2">
          <MobileCalendarMonth
            startDate={startDate}
            posts={postsMapped}
            proposals={proposals}
            onDayPress={setSelectedDate}
          />
        </div>
      )}

      {!loading && view === 'week' && (
        <div className="py-2">
          <MobileCalendarWeek
            startDate={startDate}
            posts={postsMapped}
            proposals={proposals}
            integrations={integrations}
            onPostPress={handlePostPress}
          />
        </div>
      )}

      <DaySheet
        date={selectedDate}
        posts={allSheetPosts}
        integrations={integrations}
        onClose={() => setSelectedDate(null)}
        onPostPress={handlePostPress}
      />
    </div>
  );
}

// View toggle button used in the header
export function CalendarViewToggle() {
  const { view, setView } = useMobileCalendarConfig();

  return (
    <div className="flex items-center rounded-lg overflow-hidden border border-newBorder">
      <button
        type="button"
        onClick={() => setView('month')}
        className={clsx(
          'px-2.5 py-1 text-[11px] font-medium transition-colors',
          view === 'month'
            ? 'bg-btnPrimary text-white'
            : 'bg-transparent text-textItemBlur'
        )}
      >
        Monat
      </button>
      <button
        type="button"
        onClick={() => setView('week')}
        className={clsx(
          'px-2.5 py-1 text-[11px] font-medium transition-colors',
          view === 'week'
            ? 'bg-btnPrimary text-white'
            : 'bg-transparent text-textItemBlur'
        )}
      >
        Woche
      </button>
    </div>
  );
}

// Navigation arrow buttons used in the header
export function CalendarNavButtons() {
  const { setFilters, startDate, endDate } = useCalendar();
  const { view } = useMobileCalendarConfig();

  const navigate = useCallback(
    (direction: -1 | 1) => {
      const unit = view === 'month' ? 'month' : 'week';
      const newStart = newDayjs(startDate).add(direction, unit).startOf(
        unit === 'month' ? 'month' : 'isoWeek'
      );
      const newEnd =
        unit === 'month'
          ? newStart.endOf('month')
          : newStart.endOf('isoWeek');

      setFilters({
        startDate: newStart.format('YYYY-MM-DD'),
        endDate: newEnd.format('YYYY-MM-DD'),
        display: unit === 'month' ? 'month' : 'week',
        customer: null,
      });
    },
    [view, startDate, endDate, setFilters]
  );

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        data-testid="calendar-nav-prev"
        aria-label="Vorheriger Zeitraum"
        onClick={() => navigate(-1)}
        className="p-1.5 rounded-lg text-textItemBlur active:opacity-60 transition-opacity"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="10 4 6 8 10 12" />
        </svg>
      </button>
      <button
        type="button"
        data-testid="calendar-nav-next"
        aria-label="Nächster Zeitraum"
        onClick={() => navigate(1)}
        className="p-1.5 rounded-lg text-textItemBlur active:opacity-60 transition-opacity"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 4 10 8 6 12" />
        </svg>
      </button>
    </div>
  );
}

// Month/week label for the header
export function CalendarPeriodLabel() {
  const { startDate } = useCalendar();
  const { view } = useMobileCalendarConfig();

  const label =
    view === 'month'
      ? newDayjs(startDate).format('MMMM YYYY')
      : `KW ${newDayjs(startDate).isoWeek()} ${newDayjs(startDate).year()}`;

  return (
    <span data-testid="calendar-period-label" className="text-sm font-semibold text-newTextColor">
      {label}
    </span>
  );
}

// Sticky in-page header (inside provider context so it can read calendar state)
function CalendarHeader() {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-newBgColor border-b border-newBorder">
      <div className="flex items-center gap-2">
        <CalendarNavButtons />
        <CalendarPeriodLabel />
      </div>
      <CalendarViewToggle />
    </div>
  );
}

// Root export — mounts CalendarWeekProvider and renders CalendarInner
export function MobileCalendar() {
  const { data: integrations = [] } = useIntegrationList();
  const activeIntegrations = integrations.filter((i: { disabled?: boolean }) => !i.disabled);

  return (
    <CalendarWeekProvider integrations={activeIntegrations}>
      <div className="flex flex-col h-full">
        <CalendarHeader />
        <CalendarInner />
      </div>
    </CalendarWeekProvider>
  );
}
