'use client';

import type { FC } from 'react';
import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';

interface PostTitleProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const PostTitle: FC<PostTitleProps> = ({
  value,
  onChange,
  placeholder = 'Titel eingeben…',
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const escapedRef = useRef(false);

  const handleTap = useCallback(() => {
    setDraft(value);
    escapedRef.current = false;
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [value]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (!escapedRef.current && draft.trim() !== value) {
      onChange(draft.trim());
    }
    escapedRef.current = false;
  }, [draft, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        inputRef.current?.blur();
      }
      if (e.key === 'Escape') {
        escapedRef.current = true;
        setDraft(value);
        setEditing(false);
      }
    },
    [value]
  );

  if (editing) {
    return (
      <textarea
        data-testid="post-title-input"
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        rows={2}
        className={clsx(
          'w-full bg-transparent resize-none outline-none',
          'text-2xl font-bold text-newTextColor leading-tight',
          'placeholder:text-textItemBlur'
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      type="button"
      data-testid="post-title"
      onClick={handleTap}
      className="w-full text-left"
    >
      {value ? (
        <h1 className="text-2xl font-bold text-newTextColor leading-tight">
          {value}
        </h1>
      ) : (
        <span className="text-2xl font-bold text-textItemBlur leading-tight">
          {placeholder}
        </span>
      )}
    </button>
  );
};
