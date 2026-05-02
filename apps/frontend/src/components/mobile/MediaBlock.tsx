'use client';

import type { FC, RefObject } from 'react';
import { useCallback, useState } from 'react';
import clsx from 'clsx';
import { useMediaUpload } from '@gitroom/frontend/hooks/use-media-upload';
import type { PostMedia } from '@gitroom/frontend/hooks/use-post-detail';

interface MediaBlockProps {
  media: PostMedia[];
  onMediaChange: (media: PostMedia[]) => void;
  onCommentTap?: () => void;
  imageInputRef?: RefObject<HTMLInputElement | null>;
  videoInputRef?: RefObject<HTMLInputElement | null>;
  imageNotes?: Record<string, string>;
  onImageNoteChange?: (mediaId: string, note: string) => void;
}

function isVideo(path: string) {
  return /\.(mp4|webm|mov|quicktime)$/i.test(path);
}

export const MediaBlock: FC<MediaBlockProps> = ({
  media,
  onMediaChange,
  onCommentTap,
  imageInputRef,
  videoInputRef,
  imageNotes = {},
  onImageNoteChange,
}) => {
  const { uploadFile, uploading } = useMediaUpload();
  const [activeIndex, setActiveIndex] = useState(0);
  // per-item fit: 'contain' = original aspect ratio (default), 'cover' = square crop
  const [fitModes, setFitModes] = useState<Record<number, 'contain' | 'cover'>>({});

  const getFit = (idx: number): 'contain' | 'cover' => fitModes[idx] ?? 'contain';

  const toggleFit = useCallback((idx: number) => {
    setFitModes((prev) => ({
      ...prev,
      [idx]: prev[idx] === 'cover' ? 'contain' : 'cover',
    }));
  }, []);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      const results = await Promise.all(files.map((f) => uploadFile(f)));
      const uploaded = results.filter((r): r is PostMedia => r !== null);
      if (uploaded.length > 0) {
        const next = [...media, ...uploaded];
        onMediaChange(next);
        setActiveIndex(next.length - 1);
      }
      e.target.value = '';
    },
    [media, uploadFile, onMediaChange]
  );

  const handleDelete = useCallback(
    (idx: number) => {
      const next = media.filter((_, i) => i !== idx);
      onMediaChange(next);
      // Re-index fitModes after deletion
      setFitModes((prev) => {
        const updated: Record<number, 'contain' | 'cover'> = {};
        Object.entries(prev).forEach(([k, v]) => {
          const ki = Number(k);
          if (ki < idx) updated[ki] = v;
          else if (ki > idx) updated[ki - 1] = v;
        });
        return updated;
      });
      setActiveIndex((prev) => Math.min(prev, Math.max(0, next.length - 1)));
    },
    [media, onMediaChange]
  );

  const currentItem = media[activeIndex];
  const fit = getFit(activeIndex);

  return (
    <div data-testid="media-block" className="w-full rounded-xl overflow-hidden border border-newBorder bg-newBgColorInner">
      {media.length > 0 && currentItem ? (
        <div className="relative w-full">
          {/* Main media display */}
          <div className={clsx('relative w-full', fit === 'cover' ? 'aspect-square' : 'aspect-auto min-h-[200px]')}>
            {isVideo(currentItem.path) ? (
              <video
                data-testid="media-item"
                key={currentItem.path}
                src={currentItem.path}
                className={clsx('w-full h-full', fit === 'cover' ? 'object-cover' : 'object-contain bg-black')}
                controls
                playsInline
              />
            ) : (
              <img
                data-testid="media-item"
                src={currentItem.thumbnail ?? currentItem.path}
                alt="Media"
                className={clsx('w-full h-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
              />
            )}

            {/* Delete button — top right */}
            <button
              type="button"
              data-testid="media-delete"
              onClick={() => handleDelete(activeIndex)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center active:opacity-60 transition-opacity"
              aria-label="Bild entfernen"
            >
              <span className="text-white text-sm leading-none">✕</span>
            </button>

            {/* Fit toggle — top left */}
            <button
              type="button"
              data-testid="media-fit-toggle"
              onClick={() => toggleFit(activeIndex)}
              className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/60 active:opacity-60 transition-opacity"
              aria-label="Darstellung wechseln"
            >
              <span className="text-white text-[10px] font-medium">
                {fit === 'contain' ? 'Original' : 'Square'}
              </span>
            </button>
          </div>

          {/* KI-Bearbeitungs-Notiz fuer aktives Bild */}
          {currentItem && onImageNoteChange && (
            <div className="px-3 py-2 border-t border-newBorder bg-newBgColor">
              <label className="text-[10px] font-medium text-textItemBlur uppercase tracking-wide block mb-1">
                KI-Hinweis fuer dieses Bild
              </label>
              <textarea
                key={currentItem.id ?? activeIndex}
                data-testid="media-ai-note"
                defaultValue={imageNotes[currentItem.id] ?? ''}
                placeholder="z.B. 'Hintergrund unscharf machen' oder 'Person zentrieren'"
                rows={2}
                onChange={(e) => onImageNoteChange(currentItem.id, e.target.value)}
                className="w-full rounded-md border border-newBorder bg-newBgColorInner px-2 py-1.5 text-xs text-newTextColor placeholder:text-textItemBlur focus:outline-none focus:border-btnPrimary resize-none"
              />
            </div>
          )}

          {/* Thumbnail strip — only when multiple items */}
          {media.length > 1 && (
            <div className="flex gap-1.5 p-2 overflow-x-auto" data-testid="media-carousel">
              {media.map((item, idx) => (
                <button
                  key={item.id ?? String(idx)}
                  type="button"
                  data-testid={`media-thumb-${idx}`}
                  onClick={() => setActiveIndex(idx)}
                  className={clsx(
                    'flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-colors',
                    idx === activeIndex ? 'border-btnPrimary' : 'border-transparent opacity-60'
                  )}
                >
                  {isVideo(item.path) ? (
                    <div className="w-full h-full bg-newBgColor flex items-center justify-center">
                      <span className="text-sm">🎬</span>
                    </div>
                  ) : (
                    <img
                      src={item.thumbnail ?? item.path}
                      alt={`Bild ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="w-full aspect-square flex flex-col items-center justify-center gap-3 bg-newBgColorInner cursor-pointer active:opacity-60 transition-opacity"
          onClick={() => imageInputRef?.current?.click()}
          role="button"
          data-testid="media-empty-state"
        >
          <span className="text-3xl">📷</span>
          <span className="text-textItemBlur text-sm">Bild hinzufügen</span>
        </div>
      )}

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

      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          data-testid="media-upload"
          onClick={() => imageInputRef?.current?.click()}
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
            {uploading ? 'Lädt…' : 'Bild Upload'}
          </span>
        </button>

        <button
          type="button"
          data-testid="media-video-upload"
          onClick={() => videoInputRef?.current?.click()}
          disabled={uploading}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5',
            'border border-newBorder bg-newBgColor text-sm text-newTextColor',
            'active:opacity-60 transition-opacity',
            uploading && 'opacity-50'
          )}
        >
          <span>🎬</span>
          <span className="text-xs font-medium">
            {uploading ? 'Lädt…' : 'Video Upload'}
          </span>
        </button>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*,video/quicktime"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
};
