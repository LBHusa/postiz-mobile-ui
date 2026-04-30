'use client';

import type { FC } from 'react';
import clsx from 'clsx';
import { StatusDot } from './StatusDot';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';
import { mapPostizState } from '@gitroom/frontend/hooks/use-status-mapping';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

interface DotEntry {
  status: MobileStatus;
}

interface CalendarDayCellProps {
  date: string; // YYYY-MM-DD
  dots: DotEntry[];
  isCurrentMonth: boolean;
  onPress: (date: string) => void;
}

const MAX_DOTS = 4;

export const CalendarDayCell: FC<CalendarDayCellProps> = ({
  date,
  dots,
  isCurrentMonth,
  onPress,
}) => {
  const today = newDayjs().format('YYYY-MM-DD');
  const isToday = date === today;
  const dayNum = newDayjs(date).date();
  const overflow = dots.length > MAX_DOTS ? dots.length - MAX_DOTS : 0;
  const visibleDots = dots.slice(0, MAX_DOTS);

  return (
    <button
      type="button"
      data-testid="calendar-day-cell"
      data-today={isToday ? 'true' : 'false'}
      data-date={date}
      onClick={() => onPress(date)}
      className={clsx(
        'flex flex-col items-center gap-0.5 py-1 w-full min-h-[48px] select-none active:opacity-60 transition-opacity',
        !isCurrentMonth && 'opacity-30',
        isToday && 'today'
      )}
    >
      <span
        className={clsx(
          'flex items-center justify-center rounded-full text-xs font-medium leading-none',
          'w-6 h-6',
          isToday
            ? 'bg-btnPrimary text-white'
            : 'text-newTextColor'
        )}
      >
        {dayNum}
      </span>
      <span className="flex items-center justify-center gap-0.5 flex-wrap min-h-[10px]">
        {visibleDots.map((dot, i) => (
          <StatusDot key={i} status={dot.status} size={6} />
        ))}
        {overflow > 0 && (
          <span data-testid="dot-overflow" className="text-textItemBlur" style={{ fontSize: 8 }}>
            +{overflow}
          </span>
        )}
      </span>
    </button>
  );
};
