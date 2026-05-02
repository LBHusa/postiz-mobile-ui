'use client';

import { useCallback, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useRouter } from 'next/navigation';
import { usePostDetail } from '@gitroom/frontend/hooks/use-post-detail';
import { usePostMutate } from '@gitroom/frontend/hooks/use-post-mutate';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { mapPostizState } from '@gitroom/frontend/hooks/use-status-mapping';
import { PostTitle } from './PostTitle';
import { PostProperties } from './PostProperties';
import { PostBodyEditor } from './PostBodyEditor';
import { MediaBlock } from './MediaBlock';
import { PlatformList } from './PlatformList';
import { CommentsSection } from './CommentsSection';
import { CommentInput } from './CommentInput';
import { MediaCommentInput } from './MediaCommentInput';
import { StatusPicker } from './StatusPicker';
import { PostActionBar } from './PostActionBar';
import { useComments } from '@gitroom/frontend/hooks/use-comments';
import { useToaster } from '@gitroom/react/toaster/toaster';
import type { PostMedia } from '@gitroom/frontend/hooks/use-post-detail';
import { serializePostNotes } from '@gitroom/frontend/hooks/use-post-detail';

interface MobilePostDetailProps {
  postId: string;
}

export function MobilePostDetail({ postId }: MobilePostDetailProps) {
  const router = useRouter();
  const toaster = useToaster();
  const fetch = useFetch();
  const { data: post, mutate, isLoading } = usePostDetail(postId);
  const mutators = usePostMutate(postId, mutate);

  const handleDelete = useCallback(async () => {
    if (!post) return;
    if (!window.confirm('Beitrag wirklich löschen?')) return;
    try {
      const res = await fetch(`/posts/${post.group}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toaster.show('Beitrag gelöscht', 'success');
      router.replace('/m/kalender');
    } catch {
      toaster.show('Fehler beim Löschen', 'warning');
    }
  }, [post, fetch, toaster, router]);

  const publishDate = post?.publishDate ?? new Date().toISOString();
  const { addComment } = useComments(publishDate);

  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>(
    post ? [post.integration.id] : []
  );

  const prevContentRef = useRef<string>('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Overlay state
  const [showPageComment, setShowPageComment] = useState(false);
  const [showMediaComment, setShowMediaComment] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Title is derived from the first line of content (UI-only, no separate title field in Postiz)
  const rawContent = post?.value?.[0]?.content ?? '';
  const lines = rawContent.split('\\n');
  const title = lines[0]?.replace(/<[^>]+>/g, '') ?? '';
  const bodyContent = lines.slice(1).join('\\n') || rawContent;

  const media: PostMedia[] = post?.value?.[0]?.media ?? [];
  const notes = post?.notes ?? { note: '', imageNotes: {} };

  // Persistiert beide Notes-Felder (allgemeine Notiz + per-Bild) in Postiz description als JSON.
  const persistNotes = useDebouncedCallback(
    async (next: { note: string; imageNotes: Record<string, string> }) => {
      try {
        await mutators.updateDescription(serializePostNotes(next));
      } catch {
        mutate();
      }
    },
    600
  );

  const handleDescriptionChange = useCallback(
    (newNote: string) => {
      persistNotes({ note: newNote, imageNotes: notes.imageNotes });
    },
    [persistNotes, notes.imageNotes]
  );

  const handleImageNoteChange = useCallback(
    (mediaId: string, value: string) => {
      const nextImageNotes = { ...notes.imageNotes };
      if (value) {
        nextImageNotes[mediaId] = value;
      } else {
        delete nextImageNotes[mediaId];
      }
      persistNotes({ note: notes.note, imageNotes: nextImageNotes });
    },
    [persistNotes, notes.note, notes.imageNotes]
  );

  const handleTitleChange = useDebouncedCallback(
    async (newTitle: string) => {
      prevContentRef.current = rawContent;
      const newContent = [newTitle, ...lines.slice(1)].join('\\n');
      try {
        await mutators.updateContent(newContent);
      } catch {
        mutate();
      }
    },
    400
  );

  const handleBodyChange = useDebouncedCallback(
    async (html: string) => {
      prevContentRef.current = rawContent;
      const newContent = lines[0] ? `${lines[0]}\\n${html}` : html;
      try {
        await mutators.updateContent(newContent);
      } catch {
        // Network failure — re-fetch to revert optimistic UI
        mutate();
      }
    },
    400
  );

  const handleMediaChange = useCallback(
    async (newMedia: PostMedia[]) => {
      try {
        await mutators.updateMedia(newMedia);
      } catch {
        mutate();
      }
    },
    [mutators, mutate]
  );

  const handlePublish = useCallback(async () => {
    if (!publishDate) {
      toaster.show('Bitte erst Datum + Uhrzeit setzen', 'warning');
      return;
    }
    // Schutz: KEIN Schedule auf Vergangenheits-Datum.
    // Postiz-Workflow published sonst sofort, auch wenn der Status formal DRAFT war.
    const target = new Date(publishDate).getTime();
    const now = Date.now();
    if (target <= now + 60_000) {
      toaster.show(
        'Datum liegt in der Vergangenheit oder weniger als 1 Minute in der Zukunft. Bitte aktualisieren.',
        'warning'
      );
      return;
    }
    setPublishing(true);
    try {
      await mutators.schedulePost(publishDate);
    } catch {
      toaster.show('Fehler beim Einplanen', 'warning');
    } finally {
      setPublishing(false);
    }
  }, [mutators, publishDate, toaster]);

  const handleAddPageComment = useCallback(
    async (content: string) => {
      await addComment(content, 'page');
    },
    [addComment]
  );

  const handleAddMediaComment = useCallback(
    async (content: string) => {
      await addComment(content, 'media');
    },
    [addComment]
  );

  const handleImageTap = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleVideoTap = useCallback(() => {
    videoInputRef.current?.click();
  }, []);

  if (isLoading) {
    return (
      <div data-testid="post-detail-loading" className="flex items-center justify-center py-16">
        <span className="text-textItemBlur text-sm">Lädt…</span>
      </div>
    );
  }

  if (!post) {
    return (
      <div data-testid="post-detail-error" className="flex items-center justify-center py-16 px-4">
        <span className="text-textItemBlur text-sm text-center">Post nicht gefunden.</span>
      </div>
    );
  }

  const mobileStatus = mapPostizState(post.state);

  return (
    <div data-testid="mobile-post-detail" className="flex flex-col pb-[80px]">
      {/* Inline sub-header with back button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-newBorder">
        <button
          type="button"
          data-testid="post-detail-back"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-btnPrimary text-sm font-medium active:opacity-60 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
          Zurück
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-textItemBlur capitalize">{post.integration.identifier}</span>
          <button
            type="button"
            data-testid="post-detail-delete"
            onClick={handleDelete}
            aria-label="Beitrag löschen"
            className="text-red-400 active:opacity-60 transition-opacity p-1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 flex flex-col gap-6">
        {/* Title */}
        <PostTitle
          value={title}
          onChange={handleTitleChange}
          placeholder="Post-Titel…"
        />

        {/* Properties */}
        <PostProperties
          publishDate={post.publishDate}
          state={post.state}
          integrations={[post.integration]}
          onDateChange={mutators.updateDate}
          onStatusChange={() => setShowStatusPicker(true)}
        />

        {/* Body */}
        <PostBodyEditor
          content={bodyContent}
          onChange={handleBodyChange}
        />

        {/* Media */}
        <MediaBlock
          media={media}
          onMediaChange={handleMediaChange}
          onCommentTap={() => setShowMediaComment(true)}
          imageInputRef={imageInputRef}
          videoInputRef={videoInputRef}
          imageNotes={notes.imageNotes}
          onImageNoteChange={handleImageNoteChange}
        />

        {/* Notiz / Hinweis-Feld (Postiz description, nicht im Post selbst sichtbar) */}
        <div className="flex flex-col gap-1.5" data-testid="description-block">
          <label className="text-xs font-medium text-textItemBlur">
            Notiz / Hinweis (z.B. „Bild als KI-Vorlage nutzen")
          </label>
          <textarea
            key={post?.id}
            data-testid="description-input"
            defaultValue={notes.note}
            placeholder="Interne Notiz — wird nicht gepostet"
            rows={3}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            className="w-full rounded-lg border border-newBorder bg-newBgColorInner px-3 py-2 text-sm text-newTextColor placeholder:text-textItemBlur focus:outline-none focus:border-btnPrimary resize-none"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-newSep" />

        {/* Platform list */}
        <PlatformList
          selectedIds={selectedPlatformIds}
          onSelectionChange={setSelectedPlatformIds}
        />

        {/* Divider */}
        <div className="h-px bg-newSep" />

        {/* Comments */}
        <CommentsSection
          publishDate={post.publishDate}
          onAddPageComment={() => setShowPageComment(true)}
        />
      </div>

      {/* Bottom action bar */}
      <PostActionBar
        status={mobileStatus}
        onCommentTap={() => setShowPageComment(true)}
        onImageTap={handleImageTap}
        onVideoTap={handleVideoTap}
        onStatusTap={() => setShowStatusPicker(true)}
        onPublishTap={handlePublish}
        publishing={publishing}
      />

      {/* Overlays */}
      {showPageComment && (
        <CommentInput
          onSubmit={handleAddPageComment}
          onClose={() => setShowPageComment(false)}
          title="Seitenkommentar"
        />
      )}
      {showMediaComment && (
        <MediaCommentInput
          onSubmit={handleAddMediaComment}
          onClose={() => setShowMediaComment(false)}
        />
      )}
      {showStatusPicker && (
        <StatusPicker
          current={mobileStatus}
          onSelect={async (status) => {
            setShowStatusPicker(false);
            try {
              await mutators.updateStatus(status);
            } catch {
              mutate();
            }
          }}
          onClose={() => setShowStatusPicker(false)}
        />
      )}
    </div>
  );
}
