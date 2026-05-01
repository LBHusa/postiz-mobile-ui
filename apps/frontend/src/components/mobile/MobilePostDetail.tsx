'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePostDetail } from '@gitroom/frontend/hooks/use-post-detail';
import { usePostMutate } from '@gitroom/frontend/hooks/use-post-mutate';
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
import { AdaptForButton } from './AdaptForButton';
import { useComments } from '@gitroom/frontend/hooks/use-comments';
import { useToaster } from '@gitroom/react/toaster/toaster';
import type { PostMedia } from '@gitroom/frontend/hooks/use-post-detail';

interface MobilePostDetailProps {
  postId: string;
}

export function MobilePostDetail({ postId }: MobilePostDetailProps) {
  const router = useRouter();
  const toaster = useToaster();
  const { data: post, mutate, isLoading } = usePostDetail(postId);
  const mutators = usePostMutate(postId, mutate);

  const publishDate = post?.publishDate ?? new Date().toISOString();
  const { addComment } = useComments(publishDate);

  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>(
    post ? [post.integration.id] : []
  );

  const prevContentRef = useRef<string>('');

  // Overlay state
  const [showPageComment, setShowPageComment] = useState(false);
  const [showMediaComment, setShowMediaComment] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Title is derived from the first line of content (UI-only, no separate title field in Postiz)
  const rawContent = post?.value?.[0]?.content ?? '';
  const lines = rawContent.split('\n');
  const title = lines[0]?.replace(/<[^>]+>/g, '') ?? '';
  const bodyContent = lines.slice(1).join('\n') || rawContent;

  const media: PostMedia[] = post?.value?.[0]?.media ?? [];

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      prevContentRef.current = rawContent;
      const newContent = [newTitle, ...lines.slice(1)].join('\n');
      try {
        await mutators.updateContent(newContent);
      } catch {
        mutate();
      }
    },
    [lines, mutators, rawContent, mutate]
  );

  const handleBodyChange = useCallback(
    async (html: string) => {
      prevContentRef.current = rawContent;
      const newContent = lines[0] ? `${lines[0]}\n${html}` : html;
      try {
        await mutators.updateContent(newContent);
      } catch {
        // Network failure — re-fetch to revert optimistic UI
        mutate();
      }
    },
    [lines, mutators, rawContent, mutate]
  );

  const handleMediaChange = useCallback(
    (newMedia: PostMedia[]) => {
      mutate();
      void newMedia;
    },
    [mutate]
  );

  const handlePublish = useCallback(async () => {
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
    // Scroll to media block — file input is inside MediaBlock
  }, []);

  const handleVideoTap = useCallback(() => {
    handleImageTap();
  }, [handleImageTap]);

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
        <span className="text-xs text-textItemBlur capitalize">{post.integration.identifier}</span>
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
        {media.length > 0 && (
          <MediaBlock
            media={media}
            onMediaChange={handleMediaChange}
            onCommentTap={() => setShowMediaComment(true)}
          />
        )}

        {/* Divider */}
        <div className="h-px bg-newSep" />

        {/* Platform list */}
        <PlatformList
          selectedIds={selectedPlatformIds}
          onSelectionChange={setSelectedPlatformIds}
        />

        {/* Adapt for button */}
        <AdaptForButton />

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
          onSelect={() => setShowStatusPicker(false)}
          onClose={() => setShowStatusPicker(false)}
          postId={postId}
          onTriggerRegen={mutators.triggerRegen}
        />
      )}
    </div>
  );
}
