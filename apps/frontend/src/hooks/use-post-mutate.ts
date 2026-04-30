'use client';

import { useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

export function usePostMutate(groupId: string, mutate: () => void) {
  const fetch = useFetch();
  const toaster = useToaster();

  const updateDate = useCallback(
    async (date: string) => {
      try {
        await fetch(`/posts/${groupId}/date`, {
          method: 'PUT',
          body: JSON.stringify({ date: newDayjs(date).utc().format() }),
        });
        mutate();
        toaster.show('Datum gespeichert', 'success');
      } catch {
        toaster.show('Fehler beim Speichern des Datums', 'warning');
      }
    },
    [groupId, fetch, mutate, toaster]
  );

  const updateContent = useCallback(
    async (content: string) => {
      try {
        await fetch(`/posts/${groupId}`, {
          method: 'PUT',
          body: JSON.stringify({
            type: 'post',
            value: [{ content, media: [] }],
          }),
        });
        mutate();
        toaster.show('Gespeichert', 'success');
      } catch {
        toaster.show('Fehler beim Speichern', 'warning');
      }
    },
    [groupId, fetch, mutate, toaster]
  );

  const updateStatus = useCallback(
    async (status: string) => {
      try {
        await fetch(`/posts/${groupId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        });
        mutate();
        toaster.show('Status aktualisiert', 'success');
      } catch {
        toaster.show('Fehler beim Status-Update', 'warning');
      }
    },
    [groupId, fetch, mutate, toaster]
  );

  return { updateDate, updateContent, updateStatus };
}
