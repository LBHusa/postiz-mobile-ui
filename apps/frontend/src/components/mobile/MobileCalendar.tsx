'use client';

import { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  CalendarContext,
  CalendarWeekProvider,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { useMobileCalendarConfig } from '@gitroom/frontend/hooks/use-mobile-calendar-config';
import { useMobileProposals } from '@gitroom/frontend/hooks/use-mobile-proposals';
import { useProposals } from '@gitroom/frontend/hooks/use-proposals';
import { useProposalActions } from '@gitroom/frontend/hooks/use-proposal-actions';
import { MobileCalendarMonth } from './MobileCalendarMonth';
import { MobileCalendarWeek } from './MobileCalendarWeek';
import { DaySheet } from './DaySheet';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

// Computes the ISO date range for a given reference date + view mode.
function computeRange(refDate: string, view: 'month' | 'week') {
  const d = newDayjs(refDate);
  if (view === 'month') {
    return {
      startDate: d.startOf('month').format('YYYY-MM-DD'),
      endDate: d.endOf('month').format('YYYY-MM-DD'),
      display: 'month' as const,
    };
  }
  return {
    startDate: d.startOf('isoWeek').format('YYYY-MM-DD'),
    endDate: d.endOf('isoWeek').format('YYYY-MM-DD'),
    display: 'week' as const,
  };
}

// Wraps CalendarContext and overrides setFilters so it never touches the URL,
// then propagates the new date range to the real context's internal SWR key.
function MobileCalendarContextPatch({
  children,
  onNavigate,
}: {
  children: React.ReactNode;
  onNavigate: (startDate: string, endDate: string, display: 'month' | 'week') => void;
}) {
  const realCtx = useContext(CalendarContext);

  const patchedSetFilters = useCallback(
    (filters: {
      startDate: string;
      endDate: string;
      display: 'week' | 'month' | 'day' | 'list';
      customer: string | null;
    }) => {
      // Call the real setFilters to drive SWR refetch — it writes to URL,
      // so we immediately restore the correct mobile URL after it runs.
      realCtx.setFilters(filters);
      // Restore the URL to /m/kalender (the replaceState in setFiltersWrapper
      // already fired synchronously above, so we overwrite it back).
      window.history.replaceState(null, '', '/m/kalender');
      onNavigate(
        filters.startDate,
        filters.endDate,
        (filters.display === 'month' || filters.display === 'week')
          ? filters.display
          : 'month'
      );
    },
    [realCtx, onNavigate]
  );

  const patchedCtx = { ...realCtx, setFilters: patchedSetFilters };

  return (
    <CalendarContext.Provider value={patchedCtx}>
      {children}
    </CalendarContext.Provider>
  );
}

// Inner component that consumes the (patched) CalendarContext.
function CalendarInner({ navStartDate }: { navStartDate: string }) {
  const { posts, integrations, loading } = useCalendar();
  const { proposals } = useMobileProposals();
  const { mutate: mutateProposals } = useProposals('pending');
  const { acceptProposal } = useProposalActions(mutateProposals);
  const { view } = useMobileCalendarConfig();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Mark render complete for AC14 Playwright performance measurement.
  useEffect(() => {
    if (!loading) {
      performance.mark('mobile-calendar-rendered');
    }
  }, [loading]);

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

  const selectedDayPosts = selectedDate
    ? postsMapped.filter(
        (p) => newDayjs(p.publishDate).format('YYYY-MM-DD') === selectedDate
      )
    : [];

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

  const router = useRouter();

  const handlePostPress = useCallback(
    (id: string) => {
      router.push(`/m/post/${id}`);
    },
    [router]
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
            startDate={navStartDate}
            posts={postsMapped}
            proposals={proposals}
            onDayPress={setSelectedDate}
          />
        </div>
      )}

      {!loading && view === 'week' && (
        <div className="py-2">
          <MobileCalendarWeek
            startDate={navStartDate}
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
        onAcceptProposal={acceptProposal}
      />
    </div>
  );
}

// View toggle — reads/writes localStorage-backed view preference.
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

// Navigation arrows — reads from the patched context and calls patchedSetFilters,
// which drives SWR refetch without permanently rewriting the URL.
export function CalendarNavButtons({
  navStartDate,
}: {
  navStartDate: string;
}) {
  const { setFilters } = useCalendar();
  const { view } = useMobileCalendarConfig();

  const navigate = useCallback(
    (direction: -1 | 1) => {
      const unit = view === 'month' ? 'month' : 'week';
      const newStart = newDayjs(navStartDate)
        .add(direction, unit)
        .startOf(unit === 'month' ? 'month' : 'isoWeek');
      const newEnd =
        unit === 'month'
          ? newStart.endOf('month')
          : newStart.endOf('isoWeek');

      setFilters({
        startDate: newStart.format('YYYY-MM-DD'),
        endDate: newEnd.format('YYYY-MM-DD'),
        display: unit,
        customer: null,
      });
    },
    [view, navStartDate, setFilters]
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

// Period label — derives display text from local nav state (not from context startDate
// which could lag behind the SWR key update).
export function CalendarPeriodLabel({ navStartDate }: { navStartDate: string }) {
  const { view } = useMobileCalendarConfig();

  const label =
    view === 'month'
      ? newDayjs(navStartDate).format('MMMM YYYY')
      : `KW ${newDayjs(navStartDate).isoWeek()} ${newDayjs(navStartDate).year()}`;

  return (
    <span data-testid="calendar-period-label" className="text-sm font-semibold text-newTextColor">
      {label}
    </span>
  );
}

// Sticky in-page header — inside the patched context so nav calls go through patchedSetFilters.
function CalendarHeader({ navStartDate }: { navStartDate: string }) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-newBgColor border-b border-newBorder">
      <div className="flex items-center gap-2">
        <CalendarNavButtons navStartDate={navStartDate} />
        <CalendarPeriodLabel navStartDate={navStartDate} />
      </div>
      <CalendarViewToggle />
    </div>
  );
}

// Root — owns local navigation state, mounts CalendarWeekProvider once, patches its
// context to prevent the /launches URL side-effect, and passes navStartDate down.
export function MobileCalendar() {
  const { data: integrations = [] } = useIntegrationList();
  const activeIntegrations = integrations.filter((i: { disabled?: boolean }) => !i.disabled);
  const { view } = useMobileCalendarConfig();

  const [navStartDate, setNavStartDate] = useState(() =>
    computeRange(newDayjs().format('YYYY-MM-DD'), view).startDate
  );

  const handleNavigate = useCallback(
    (startDate: string, _endDate: string, _display: 'month' | 'week') => {
      setNavStartDate(startDate);
    },
    []
  );

  return (
    <CalendarWeekProvider integrations={activeIntegrations}>
      <MobileCalendarContextPatch onNavigate={handleNavigate}>
        <div className="flex flex-col h-full">
          <CalendarHeader navStartDate={navStartDate} />
          <CalendarInner navStartDate={navStartDate} />
        </div>
      </MobileCalendarContextPatch>
    </CalendarWeekProvider>
  );
}
