'use client';

import type { FC } from 'react';
import { useCallback } from 'react';
import { useToaster } from '@gitroom/react/toaster/toaster';

export const AdaptForButton: FC = () => {
  const toaster = useToaster();

  const handleTap = useCallback(() => {
    toaster.show('Plattform-Anpassung läuft autonom auf dem Server', 'success');
  }, [toaster]);

  return (
    <button
      type="button"
      data-testid="adapt-for-button"
      onClick={handleTap}
      className="w-full rounded-xl border border-dashed border-newBorder py-3.5 flex items-center justify-center gap-2 active:opacity-60 transition-opacity"
    >
      <span className="text-sm">✨</span>
      <span className="text-sm text-textItemBlur font-medium">
        Anpassen für ausgewählte Plattformen
      </span>
    </button>
  );
};
