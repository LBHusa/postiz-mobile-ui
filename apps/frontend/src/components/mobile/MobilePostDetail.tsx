'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePostDetail } from '@gitroom/frontend/hooks/use-post-detail';
import { usePostMutate } from '@gitroom/frontend/hooks/use-post-mutate';
import { mapPostizState } from '@gitroom/frontend/hooks/use-status-mapping';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';
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
import type { PostMedia } from '@gitroom/frontend/hooks/use-post-detail';

interface MobilePostDetailProps {
  postId: string;
}

export function MobilePostDetail({ postId }: MobilePostDetailProps) {
  const router = useRouter();
  const { data: post, mutate, isLoading } = usePostDetail(postId);
  const mutators = usePostMutate(postId, mutate);

  const publishDate = post?.publishDate ?? new Date().toISOString();
  const { addComment } = useComments(publishDate);

  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>(
    post ? [post.integration.id] : []
  );

  // Overlay state
  const [showPageComment, setShowPageComment] = useState(false);
  const [showMediaComment, setShowMediaComment] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Title is the first line of the post's first value content
  const rawContent = post?.value?.[0]?.content ?? '';
  const lines = rawContent.split('\n');
  const title = lines[0]?.replace(/<[^>]+>/g, '') ?? '';
  const bodyContent = lines.slice(1).join('\n') || rawContent;

  const media: PostMedia[] = post?.value?.[0]?.media ?? [];

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      const newContent = [newTitle, ...lines.slice(1)].join('\n');
      mutators.updateContent(newContent);
    },
    [lines, mutators]
  );

  const handleBodyChange = useCallback(
    (html: string) => {
      const newContent = lines[0] ? `${lines[0]}\n${html}` : html;
      mutators.updateContent(newContent);
    },
    [lines, mutators]
  );

  const handleMediaChange = useCallback(
    (newMedia: PostMedia[]) => {
      // Optimistic local state — full save happens via updateContent
      mutate();
      void newMedia; // media stored via separate upload endpoint
    },
    [mutate]
  );

  const handleStatusChange = useCallback(
    (status: MobileStatus) => {
      mutators.updateStatus(status);
    },
    [mutators]
  );

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      await mutators.updateStatus('scheduled');
    } finally {
      setPublishing(false);
    }
  }, [mutators]);

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
    // Scroll to media block — the file input is inside MediaBlock
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
      {/* Back button is in MobileShell header — rendered via slot in page.tsx */}

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
          onStatusChange={handleStatusChange}
        />

        {/* Body */}
        <PostBodyEditor
          content={bodyContent}
          onChange={handleBodyChange}
        />

        {/* Media */}
        {(media.length > 0 || true) && (
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
          onSelect={handleStatusChange}
          onClose={() => setShowStatusPicker(false)}
        />
      )}
    </div>
  );
}
