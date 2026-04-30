'use client';

import type { FC } from 'react';
import clsx from 'clsx';
import { useStatusMapping } from '@gitroom/frontend/hooks/use-status-mapping';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';

interface PostActionBarProps {
  status: MobileStatus;
  onCommentTap: () => void;
  onImageTap: () => void;
  onVideoTap: () => void;
  onStatusTap: () => void;
  onPublishTap: () => void;
  publishing?: boolean;
}

export const PostActionBar: FC<PostActionBarProps> = ({
  status,
  onCommentTap,
  onImageTap,
  onVideoTap,
  onStatusTap,
  onPublishTap,
  publishing = false,
}) => {
  const { getConfig } = useStatusMapping();
  const config = getConfig(status);
  const isOnline = status === 'online';

  return (
    <div
      data-testid="post-action-bar"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-1 px-3 bg-newBgColor border-t border-newBorder"
      style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', paddingTop: 12 }}
    >
      {/* Comment */}
      <button
        type="button"
        data-testid="action-comment"
        onClick={onCommentTap}
        className="flex flex-col items-center gap-0.5 flex-1 active:opacity-60 transition-opacity"
      >
        <span className="text-lg">💬</span>
        <span className="text-[9px] text-textItemBlur">Komm.</span>
      </button>

      {/* Image */}
      <button
        type="button"
        data-testid="action-image"
        onClick={onImageTap}
        className="flex flex-col items-center gap-0.5 flex-1 active:opacity-60 transition-opacity"
      >
        <span className="text-lg">📷</span>
        <span className="text-[9px] text-textItemBlur">Bild</span>
      </button>

      {/* Video */}
      <button
        type="button"
        data-testid="action-video"
        onClick={onVideoTap}
        className="flex flex-col items-center gap-0.5 flex-1 active:opacity-60 transition-opacity"
      >
        <span className="text-lg">🎬</span>
        <span className="text-[9px] text-textItemBlur">Video</span>
      </button>

      {/* Status picker */}
      <button
        type="button"
        data-testid="action-status"
        onClick={onStatusTap}
        className="flex flex-col items-center gap-0.5 flex-1 active:opacity-60 transition-opacity"
      >
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: config.color + '22', color: config.color }}
        >
          {config.label} ▾
        </span>
        <span className="text-[9px] text-textItemBlur">Status</span>
      </button>

      {/* Publish */}
      <button
        type="button"
        data-testid="action-publish"
        onClick={onPublishTap}
        disabled={isOnline || publishing}
        className={clsx(
          'flex-1 rounded-lg py-2 text-xs font-semibold transition-opacity',
          isOnline || publishing
            ? 'bg-newBgColorInner text-textItemBlur opacity-50'
            : 'bg-btnPrimary text-white active:opacity-80'
        )}
      >
        {publishing ? '…' : isOnline ? 'Online' : '📤 Planen'}
      </button>
    </div>
  );
};
