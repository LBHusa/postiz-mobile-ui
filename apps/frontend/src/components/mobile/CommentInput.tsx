'use client';

import type { FC } from 'react';
import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
  title?: string;
  placeholder?: string;
}

export const CommentInput: FC<CommentInputProps> = ({
  onSubmit,
  onClose,
  title = 'Kommentar',
  placeholder = 'Kommentar schreiben…',
}) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, onSubmit, onClose]);

  return (
    <div
      data-testid="comment-input"
      className="fixed inset-0 z-[110] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-t-2xl bg-newBgColor border-t border-newBorder animate-normalFadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-newSep" />
        </div>

        <div className="px-4 py-3 border-b border-newBorder flex items-center justify-between">
          <h2 className="text-base font-semibold text-newTextColor">{title}</h2>
          <button type="button" onClick={onClose} className="text-textItemBlur text-sm active:opacity-60">
            Abbrechen
          </button>
        </div>

        <div className="px-4 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className={clsx(
              'w-full rounded-lg border border-newBorder bg-newBgColorInner',
              'px-3 py-2.5 text-sm text-newTextColor resize-none outline-none',
              'placeholder:text-textItemBlur focus:border-btnPrimary transition-colors'
            )}
          />
        </div>

        <div
          className="px-4 pb-6"
          style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            data-testid="comment-submit"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className={clsx(
              'w-full rounded-lg bg-btnPrimary text-white py-3 text-sm font-semibold transition-opacity',
              (!text.trim() || submitting) ? 'opacity-40' : 'active:opacity-80'
            )}
          >
            {submitting ? 'Speichern…' : 'Kommentar hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  );
};
