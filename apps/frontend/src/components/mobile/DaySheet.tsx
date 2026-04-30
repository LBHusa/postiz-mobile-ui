'use client';

import type { FC } from 'react';
import { useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { CalendarPostCard } from './CalendarPostCard';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';
import { mapPostizState } from '@gitroom/frontend/hooks/use-status-mapping';
import type { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { useToaster } from '@gitroom/react/toaster/toaster';

interface PostEntry {
  id: string;
  publishDate: string;
  content: string;
  state: string;
  integration: { id: string };
  isProposal?: boolean;
}

interface DaySheetProps {
  date: string | null;
  posts: PostEntry[];
  integrations: Integrations[];
  onClose: () => void;
  onPostPress: (id: string) => void;
}

export const DaySheet: FC<DaySheetProps> = ({
  date,
  posts,
  integrations,
  onClose,
  onPostPress,
}) => {
  const toaster = useToaster();

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!date) return null;

  const dayLabel = newDayjs(date).format('dddd, D. MMMM');

  const handleNewPost = () => {
    toaster.show('Phase 3 noch nicht da — Detail-Page kommt in Phase 3', 'warning');
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleBackdropClick}
    >
      <div
        data-testid="day-sheet"
        className={clsx(
          'w-full rounded-t-2xl bg-newBgColor border-t border-newBorder',
          'flex flex-col max-h-[80vh]',
          'animate-normalFadeIn'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-newSep" />
        </div>

        {/* Header */}
        <div className="px-4 py-2 border-b border-newBorder">
          <h2 className="text-base font-semibold text-newTextColor capitalize">
            {dayLabel}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {posts.map((post) => {
            const status = post.isProposal
              ? ('proposal' as MobileStatus)
              : mapPostizState(post.state);
            const postIntegrations = integrations.filter(
              (i) => i.id === post.integration.id
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

          {/* New post button */}
          <button
            type="button"
            onClick={handleNewPost}
            className={clsx(
              'w-full rounded-lg border border-dashed border-newBorder',
              'py-3 text-sm text-textItemBlur text-center',
              'active:opacity-60 transition-opacity'
            )}
          >
            + Neuer Post für diesen Tag
          </button>
        </div>
      </div>
    </div>
  );
};
