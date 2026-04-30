'use client';

import type { FC } from 'react';
import { useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Bold from '@tiptap/extension-bold';
import Text from '@tiptap/extension-text';
import Paragraph from '@tiptap/extension-paragraph';
import Underline from '@tiptap/extension-underline';
import { History } from '@tiptap/extension-history';

// Prevent bold+underline co-existing (mirrors desktop editor behavior)
const InterceptBoldShortcut = Extension.create({
  name: 'mobileBoldShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-b': () => {
        this?.editor?.commands?.unsetUnderline();
        return this?.editor?.commands?.toggleBold();
      },
    };
  },
});

interface PostBodyEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export const PostBodyEditor: FC<PostBodyEditorProps> = ({
  content,
  onChange,
  placeholder = 'Schreib deinen Post…',
  readOnly = false,
}) => {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Underline,
      History,
      InterceptBoldShortcut,
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Sync content if it changes externally (e.g. optimistic rollback)
  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const toggleUnderline = useCallback(() => editor?.chain().focus().toggleUnderline().run(), [editor]);

  const isBold = editor?.isActive('bold') ?? false;
  const isUnderline = editor?.isActive('underline') ?? false;

  return (
    <div data-testid="post-body-editor" className="flex flex-col gap-2">
      {/* Minimal mobile toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1 border-b border-newBorder pb-2">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); toggleBold(); }}
            className={clsx(
              'w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors',
              isBold ? 'bg-btnPrimary text-white' : 'bg-newBgColorInner text-newTextColor'
            )}
            aria-label="Fett"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); toggleUnderline(); }}
            className={clsx(
              'w-8 h-8 flex items-center justify-center rounded text-sm underline transition-colors',
              isUnderline ? 'bg-btnPrimary text-white' : 'bg-newBgColorInner text-newTextColor'
            )}
            aria-label="Unterstrichen"
          >
            U
          </button>
        </div>
      )}

      <EditorContent
        editor={editor}
        className={clsx(
          'min-h-[160px] text-sm text-newTextColor leading-relaxed',
          'prose prose-sm max-w-none',
          '[&_.ProseMirror]:outline-none',
          `[&_.ProseMirror:empty:before]:content-[attr(data-placeholder)] [&_.ProseMirror:empty:before]:text-textItemBlur [&_.ProseMirror:empty:before]:pointer-events-none`
        )}
        data-placeholder={placeholder}
      />
    </div>
  );
};
