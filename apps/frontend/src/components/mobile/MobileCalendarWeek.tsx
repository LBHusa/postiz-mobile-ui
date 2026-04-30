'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import clsx from 'clsx';
import { CalendarPostCard } from './CalendarPostCard';
import { mapPostizState } from '@gitroom/frontend/hooks/use-status-mapping';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';
import type { MobileProposal } from '@gitroom/frontend/hooks/use-mobile-proposals';
import type { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

interface Post {
  id: string;
  publishDate: string;
  content: string;
  state: string;
  integration: { id: string };
}

interface MobileCalendarWeekProps {
  startDate: string; // ISO YYYY-MM-DD, Monday of the week
  posts: Post[];
  proposals: MobileProposal[];
  integrations: Integrations[];
  onPostPress: (id: string) => void;
}

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const MobileCalendarWeek: FC<MobileCalendarWeekProps> = ({
  startDate,
  posts,
  proposals,
  integrations,
  onPostPress,
}) => {
  const weekStart = newDayjs(startDate).startOf('isoWeek');

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = weekStart.add(i, 'day');
      return { date: d.format('YYYY-MM-DD'), dayNum: d.date() };
    });
  }, [startDate]);

  const today = newDayjs().format('YYYY-MM-DD');

  // Group posts and proposals by date
  const byDate = useMemo(() => {
    const map: Record<
      string,
      { id: string; publishDate: string; content: string; state: string; integration: { id: string }; isProposal?: boolean }[]
    > = {};

    for (const post of posts) {
      const date = newDayjs(post.publishDate).format('YYYY-MM-DD');
      if (!map[date]) map[date] = [];
      map[date].push(post);
    }

    for (const proposal of proposals) {
      if (!map[proposal.date]) map[proposal.date] = [];
      map[proposal.date].push({
        id: proposal.id,
        publishDate: `${proposal.date}T${proposal.time}:00`,
        content: proposal.title,
        state: 'PROPOSAL',
        integration: { id: '' },
        isProposal: true,
      });
    }

    // Sort each day's entries by publishDate
    for (const date of Object.keys(map)) {
      map[date].sort(
        (a, b) =>
          new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime()
      );
    }

    return map;
  }, [posts, proposals]);

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of days) {
      map[day.date] = (byDate[day.date] ?? []).length;
    }
    return map;
  }, [byDate, days]);

  return (
    <div data-testid="mobile-calendar-week" className="w-full select-none">
      {/* 7-column day header */}
      <div className="grid grid-cols-7 border-b border-newBorder mb-2 sticky top-0 bg-newBgColor z-10">
        {days.map((day, i) => {
          const isToday = day.date === today;
          const count = countByDate[day.date];
          return (
            <div key={day.date} data-testid="week-day-header" className="flex flex-col items-center py-1.5 gap-0.5">
              <span className="text-[10px] font-medium text-textItemBlur">
                {WEEKDAYS_SHORT[i]}
              </span>
              <span
                className={clsx(
                  'flex items-center justify-center rounded-full text-xs font-semibold leading-none w-6 h-6',
                  isToday ? 'bg-btnPrimary text-white' : 'text-newTextColor'
                )}
              >
                {day.dayNum}
              </span>
              <span className="text-[9px] text-textItemBlur min-h-[12px]">
                {count > 0 ? count : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Day sections */}
      <div className="flex flex-col gap-4 px-4">
        {days.map((day, i) => {
          const dayPosts = byDate[day.date] ?? [];
          const isToday = day.date === today;

          return (
            <div key={day.date}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={clsx(
                    'text-xs font-semibold',
                    isToday ? 'text-btnPrimary' : 'text-textItemBlur'
                  )}
                >
                  {WEEKDAYS_SHORT[i]} {day.dayNum}
                </span>
                <div className="flex-1 h-px bg-newSep" />
              </div>

              {/* Posts */}
              {dayPosts.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {dayPosts.map((post) => {
                    const status: MobileStatus = post.isProposal
                      ? 'proposal'
                      : mapPostizState(post.state);
                    const postIntegrations = integrations.filter(
                      (ig) => ig.id === post.integration.id
                    );
                    return (
                      <CalendarPostCard
                        key={post.id}
                        id={post.id}
                        status={status}
                        publishDate={post.publishDate}
                        content={post.content}
                        integrations={postIntegrations}
                        isProposal={post.isProposal}
                        onPress={onPostPress}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-textItemBlur py-1">Keine Posts</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
