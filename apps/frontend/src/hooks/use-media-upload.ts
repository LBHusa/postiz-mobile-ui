'use client';

import { useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';

export interface UploadedMedia {
  id: string;
  path: string;
  thumbnail?: string;
}

export function useMediaUpload() {
  const fetch = useFetch();
  const toaster = useToaster();
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedMedia | null> => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/media/upload-simple', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        toaster.show('Datei hochgeladen', 'success');
        return data as UploadedMedia;
      } catch {
        toaster.show('Upload fehlgeschlagen', 'warning');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [fetch, toaster]
  );

  return { uploadFile, uploading };
}
