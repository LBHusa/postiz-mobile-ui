'use client';

import type { FC } from 'react';
import { useCallback, useRef } from 'react';
import clsx from 'clsx';
import { useMediaUpload } from '@gitroom/frontend/hooks/use-media-upload';
import { useToaster } from '@gitroom/react/toaster/toaster';
import type { PostMedia } from '@gitroom/frontend/hooks/use-post-detail';

interface MediaBlockProps {
  media: PostMedia[];
  onMediaChange: (media: PostMedia[]) => void;
  onCommentTap?: () => void;
}

export const MediaBlock: FC<MediaBlockProps> = ({ media, onMediaChange, onCommentTap }) => {
  const { uploadFile, uploading } = useMediaUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toaster = useToaster();

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const uploaded = await uploadFile(file);
      if (uploaded) {
        onMediaChange([...media, uploaded]);
      }
      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [media, uploadFile, onMediaChange]
  );

  const handleKiGenerate = useCallback(() => {
    toaster.show('KI-Bildgenerierung kommt in Phase 5', 'warning');
  }, [toaster]);

  const primaryMedia = media[0];

  return (
    <div data-testid="media-block" className="w-full rounded-xl overflow-hidden border border-newBorder bg-newBgColorInner">
      {primaryMedia ? (
        <div className="relative w-full aspect-[4/5]">
          {primaryMedia.path.match(/\.(mp4|webm|mov)$/i) ? (
            <video
              data-testid="media-item"
              src={primaryMedia.path}
              className="w-full h-full object-cover"
              controls={false}
              playsInline
            />
          ) : (
            <img
              data-testid="media-item"
              src={primaryMedia.thumbnail ?? primaryMedia.path}
              alt="Media"
              className="w-full h-full object-cover"
            />
          )}
        </div>
      ) : (
        <div className="w-full aspect-[4/5] flex items-center justify-center bg-newBgColorInner">
          <span className="text-textItemBlur text-sm">Kein Bild</span>
        </div>
      )}

      {/* Media comment button */}
      {onCommentTap && (
        <button
          type="button"
          data-testid="media-comment-button"
          onClick={onCommentTap}
          className="w-full px-3 py-2 flex items-center gap-1.5 border-b border-newBorder active:opacity-60 transition-opacity"
        >
          <span className="text-textItemBlur text-xs">💬</span>
          <span className="text-xs text-textItemBlur">Bild kommentieren</span>
        </button>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          data-testid="media-ki-generate"
          onClick={handleKiGenerate}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5',
            'border border-newBorder bg-newBgColor text-sm text-newTextColor',
            'active:opacity-60 transition-opacity'
          )}
        >
          <span>🤖</span>
          <span className="text-xs font-medium">KI generieren</span>
        </button>

        <button
          type="button"
          data-testid="media-upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5',
            'border border-newBorder bg-newBgColor text-sm text-newTextColor',
            'active:opacity-60 transition-opacity',
            uploading && 'opacity-50'
          )}
        >
          <span>📁</span>
          <span className="text-xs font-medium">
            {uploading ? 'Lädt…' : 'Upload'}
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </div>
  );
};
