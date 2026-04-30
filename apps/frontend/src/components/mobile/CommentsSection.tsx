'use client';

import type { FC } from 'react';
import { useState } from 'react';
import clsx from 'clsx';
import { useComments } from '@gitroom/frontend/hooks/use-comments';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

interface CommentsSectionProps {
  publishDate: string;
  onAddPageComment?: () => void;
}

export const CommentsSection: FC<CommentsSectionProps> = ({ publishDate, onAddPageComment }) => {
  const { comments, deleteComment } = useComments(publishDate);

  return (
    <div data-testid="comments-section" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-newTextColor">
          Kommentare {comments.length > 0 && `(${comments.length})`}
        </h3>
        {onAddPageComment && (
          <button
            type="button"
            data-testid="comment-input-trigger"
            onClick={onAddPageComment}
            className="text-xs text-btnPrimary font-medium active:opacity-60 transition-opacity"
          >
            + Kommentar
          </button>
        )}
      </div>

      {comments.length === 0 && (
        <p className="text-xs text-textItemBlur text-center py-4">
          Noch keine Kommentare
        </p>
      )}

      <div className="flex flex-col gap-2">
        {comments.map((comment, idx) => (
          <div
            key={comment.id}
            data-testid="comment-item"
            className="rounded-lg border border-newBorder bg-newBgColorInner px-3 py-2.5 flex flex-col gap-1"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-textItemBlur w-4">{idx + 1}</span>
                {comment.type === 'media' && (
                  <span className="text-[10px] text-textItemBlur bg-newBgColor rounded px-1 py-0.5">Bild</span>
                )}
                {comment.type === 'inline' && (
                  <span className="text-[10px] text-textItemBlur bg-newBgColor rounded px-1 py-0.5">Inline</span>
                )}
                {comment.type === 'page' && (
                  <span className="text-[10px] text-textItemBlur bg-newBgColor rounded px-1 py-0.5">Seite</span>
                )}
              </div>
              <span className="text-[10px] text-textItemBlur flex-shrink-0">
                {newDayjs(comment.createdAt).format('D. MMM HH:mm')}
              </span>
            </div>
            <p className="text-sm text-newTextColor leading-snug">{comment.content}</p>
            <button
              type="button"
              onClick={() => deleteComment(comment.id)}
              className="self-end text-[10px] text-textItemBlur active:opacity-60 transition-opacity"
            >
              Löschen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
