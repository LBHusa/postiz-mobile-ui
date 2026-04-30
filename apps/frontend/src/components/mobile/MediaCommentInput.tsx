'use client';

import type { FC } from 'react';
import { CommentInput } from './CommentInput';

interface MediaCommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
}

export const MediaCommentInput: FC<MediaCommentInputProps> = ({ onSubmit, onClose }) => (
  <div data-testid="media-comment-sheet">
    <CommentInput
      onSubmit={onSubmit}
      onClose={onClose}
      title="Bild kommentieren"
      placeholder="Kommentar zum Bild…"
    />
  </div>
);
