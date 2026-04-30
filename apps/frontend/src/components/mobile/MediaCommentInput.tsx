'use client';

import type { FC } from 'react';
import { CommentInput } from './CommentInput';

interface MediaCommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
}

export const MediaCommentInput: FC<MediaCommentInputProps> = ({ onSubmit, onClose }) => (
  <CommentInput
    data-testid="media-comment-input"
    onSubmit={onSubmit}
    onClose={onClose}
    title="Bild kommentieren"
    placeholder="Kommentar zum Bild…"
  />
);
