'use client';

import type { FC } from 'react';
import { useState } from 'react';
import { DateTimePicker } from './DateTimePicker';
import { StatusPicker } from './StatusPicker';
import { StatusDot } from './StatusDot';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';
import { mapPostizState, useStatusMapping } from '@gitroom/frontend/hooks/use-status-mapping';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import type { Integrations } from '@gitroom/frontend/components/launches/calendar.context';

interface PostPropertiesProps {
  publishDate: string;
  state: string;
  integrations: Integrations[];
  onDateChange: (iso: string) => void;
  onStatusChange: (status: MobileStatus) => void;
}

export const PostProperties: FC<PostPropertiesProps> = ({
  publishDate,
  state,
  integrations,
  onDateChange,
  onStatusChange,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const { getConfig } = useStatusMapping();

  const mobileStatus = mapPostizState(state);
  const config = getConfig(mobileStatus);
  const dateLabel = newDayjs(publishDate).format('D. MMM YYYY');
  const timeLabel = newDayjs(publishDate).format('HH:mm');

  return (
    <div data-testid="post-properties" className="flex flex-wrap gap-2 py-2">
      {/* Date + Time */}
      <button
        type="button"
        data-testid="post-date-button"
        onClick={() => setShowDatePicker(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-newBgColorInner border border-newBorder active:opacity-60 transition-opacity"
      >
        <span className="text-textItemBlur text-xs">📅</span>
        <span className="text-xs text-newTextColor font-medium">{dateLabel}</span>
        <span className="text-textItemBlur text-xs">·</span>
        <span className="text-xs text-newTextColor font-medium">{timeLabel}</span>
      </button>

      {/* Status */}
      <button
        type="button"
        data-testid="post-status-button"
        onClick={() => setShowStatusPicker(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border active:opacity-60 transition-opacity"
        style={{ backgroundColor: config.color + '18', borderColor: config.color + '44' }}
      >
        <StatusDot status={mobileStatus} size={8} />
        <span className="text-xs font-medium" style={{ color: config.color }}>
          {config.label}
        </span>
      </button>

      {/* Platform logos */}
      {integrations.length > 0 && (
        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-newBgColorInner border border-newBorder">
          {integrations.slice(0, 3).map((i) => (
            <img
              key={i.id}
              src={i.picture}
              alt={i.name}
              width={16}
              height={16}
              className="rounded-full object-cover"
              style={{ width: 16, height: 16 }}
            />
          ))}
          {integrations.length > 3 && (
            <span className="text-[10px] text-textItemBlur">+{integrations.length - 3}</span>
          )}
        </div>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={publishDate}
          onConfirm={onDateChange}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {showStatusPicker && (
        <StatusPicker
          current={mobileStatus}
          onSelect={onStatusChange}
          onClose={() => setShowStatusPicker(false)}
        />
      )}
    </div>
  );
};
