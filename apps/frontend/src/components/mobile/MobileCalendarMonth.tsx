'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import { CalendarDayCell } from './CalendarDayCell';
import { mapPostizState } from '@gitroom/frontend/hooks/use-status-mapping';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';
import type { MobileProposal } from '@gitroom/frontend/hooks/use-mobile-proposals';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

interface Post {
  id: string;
  publishDate: string;
  state: string;
}

interface MobileCalendarMonthProps {
  startDate: string;
  posts: Post[];
  proposals: MobileProposal[];
  onDayPress: (date: string) => void;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const MobileCalendarMonth: FC<MobileCalendarMonthProps> = ({
  startDate,
  posts,
  proposals,
  onDayPress,
}) => {
  const monthStart = newDayjs(startDate).startOf('month');
  const monthEnd = monthStart.endOf('month');

  // Build 6-week grid starting from Monday of the first week
  const gridStart = monthStart.startOf('isoWeek');

  const cells = useMemo(() => {
    const result: { date: string; isCurrentMonth: boolean }[] = [];
    let cursor = gridStart;
    // Always render 6 rows × 7 cols = 42 cells
    for (let i = 0; i < 42; i++) {
      result.push({
        date: cursor.format('YYYY-MM-DD'),
        isCurrentMonth:
          cursor.month() === monthStart.month() &&
          cursor.year() === monthStart.year(),
      });
      cursor = cursor.add(1, 'day');
    }
    return result;
  }, [startDate]);

  // Index posts by date
  const postsByDate = useMemo(() => {
    const map: Record<string, { status: MobileStatus }[]> = {};
    for (const post of posts) {
      const date = newDayjs(post.publishDate).format('YYYY-MM-DD');
      if (!map[date]) map[date] = [];
      map[date].push({ status: mapPostizState(post.state) });
    }
    for (const proposal of proposals) {
      if (!map[proposal.date]) map[proposal.date] = [];
      map[proposal.date].push({ status: 'proposal' });
    }
    return map;
  }, [posts, proposals]);

  return (
    <div data-testid="mobile-calendar-month" className="w-full select-none">
      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-medium text-textItemBlur py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => (
          <CalendarDayCell
            key={cell.date}
            date={cell.date}
            dots={postsByDate[cell.date] ?? []}
            isCurrentMonth={cell.isCurrentMonth}
            onPress={onDayPress}
          />
        ))}
      </div>
    </div>
  );
};
