'use client';

import type { FC } from 'react';
import clsx from 'clsx';
import { StatusDot } from './StatusDot';
import { PlatformLogos } from './PlatformLogos';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';
import { useStatusMapping } from '@gitroom/frontend/hooks/use-status-mapping';
import type { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

interface CalendarPostCardProps {
  id: string;
  status: MobileStatus;
  publishDate: string;
  content: string;
  integrations: Integrations[];
  isProposal?: boolean;
  onPress?: (id: string) => void;
}

export const CalendarPostCard: FC<CalendarPostCardProps> = ({
  id,
  status,
  publishDate,
  content,
  integrations,
  isProposal = false,
  onPress,
}) => {
  const { getConfig } = useStatusMapping();
  const config = getConfig(status);
  const time = newDayjs(publishDate).format('HH:mm');
  const snippet = content.length > 60 ? content.slice(0, 60) + '…' : content;

  return (
    <button
      type="button"
      data-testid="calendar-post-card"
      onClick={() => onPress?.(id)}
      className={clsx(
        'w-full text-left rounded-lg border px-3 py-2.5 flex flex-col gap-1',
        'border-newBorder bg-newBgColorInner active:opacity-70 transition-opacity'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <StatusDot status={status} size={8} />
          <span className="text-xs font-medium text-textItemBlur">{time}</span>
          {isProposal && (
            <span className="text-xs text-textItemBlur">(Vorschlag)</span>
          )}
        </div>
        <PlatformLogos integrations={integrations} size={16} max={3} />
      </div>
      <p
        className="text-sm text-newTextColor leading-snug text-left"
        style={{ color: `rgb(var(--new-textColor))` }}
      >
        {snippet}
      </p>
      <div className="flex items-center gap-1">
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: config.color + '22', color: config.color }}
        >
          {config.label}
        </span>
      </div>
    </button>
  );
};
