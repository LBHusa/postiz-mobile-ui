'use client';

import { useCallback, useContext } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { RegenContext } from '@gitroom/frontend/hooks/use-regen-state';

/**
 * Standalone hook — creates a new draft post via POST /posts.
 * Returns the new post's id (first in the group) for navigation.
 */
export function useCreatePost() {
  const fetch = useFetch();
  const toaster = useToaster();

  const createPost = useCallback(
    async (integrationId: string, date: string): Promise<string> => {
      try {
        const response = await fetch('/posts', {
          method: 'POST',
          body: JSON.stringify({
            type: 'draft',
            date: newDayjs(date).utc().startOf('day').add(9, 'hour').format(),
            shortLink: false,
            tags: [],
            posts: [
              {
                integration: { id: integrationId },
                value: [{ content: '', image: [] }],
                settings: {},
              },
            ],
          }),
        });
        if (!response.ok) {
          throw new Error(`createPost failed: HTTP ${response.status}`);
        }
        const data = await response.json();
        // Postiz returns the group object; first post id is in data.posts[0].id
        // or the group id itself — navigate by group id which the detail page accepts.
        const newId: string =
          data?.id ?? data?.posts?.[0]?.id ?? data?.group ?? '';
        if (!newId) throw new Error('createPost: no id in response');
        toaster.show('Entwurf erstellt', 'success');
        return newId;
      } catch (e) {
        toaster.show('Fehler beim Erstellen des Posts', 'warning');
        throw e;
      }
    },
    [fetch, toaster]
  );

  return { createPost };
}

export function usePostMutate(groupId: string, mutate: () => void) {
  const fetch = useFetch();
  const toaster = useToaster();
  const { setRegenActive, setRegenDone } = useContext(RegenContext);

  const updateDate = useCallback(
    async (date: string) => {
      try {
        const response = await fetch(`/posts/${groupId}/date`, {
          method: 'PUT',
          body: JSON.stringify({
            date: newDayjs(date).utc().format(),
            action: 'update',
          }),
        });
        if (!response.ok) {
          throw new Error(`updateDate failed: HTTP ${response.status}`);
        }
        mutate();
        toaster.show('Datum gespeichert', 'success');
      } catch (e) {
        toaster.show('Fehler beim Speichern des Datums', 'warning');
        throw e;
      }
    },
    [groupId, fetch, mutate, toaster]
  );

  // Phase-3 stub: body mutations are handled by the Server-Agent in Phase 5.
  // Throws so callers can roll back optimistic UI consistently.
  const updateContent = useCallback(
    async (_content: string): Promise<void> => {
      toaster.show(
        'Body-Speichern via Server-Agent ist Phase 5 — vorerst ungespeichert',
        'warning'
      );
      throw new Error('updateContent: Phase-5 stub — body persistence not yet wired');
    },
    [toaster]
  );

  // Schedule a draft post at its current publishDate.
  const schedulePost = useCallback(
    async (date: string) => {
      try {
        const response = await fetch(`/posts/${groupId}/date`, {
          method: 'PUT',
          body: JSON.stringify({
            date: newDayjs(date).utc().format(),
            action: 'schedule',
          }),
        });
        if (!response.ok) {
          throw new Error(`schedulePost failed: HTTP ${response.status}`);
        }
        mutate();
        toaster.show('Post eingeplant', 'success');
      } catch (e) {
        toaster.show('Fehler beim Einplanen', 'warning');
        throw e;
      }
    },
    [groupId, fetch, mutate, toaster]
  );

  const triggerRegen = useCallback(
    async (postId: string, feedback?: string) => {
      const agentBase = process.env.NEXT_PUBLIC_HUSATECH_AGENT_BASE_URL;
      const agentToken = process.env.NEXT_PUBLIC_HUSATECH_AGENT_TOKEN;

      if (!agentBase) {
        toaster.show('Agent-URL nicht konfiguriert', 'warning');
        return;
      }

      toaster.show('KI arbeitet…', 'success');
      setRegenActive(postId);

      try {
        const body: Record<string, string> = { post_id: postId };
        if (feedback) body.feedback = feedback;

        const res = await globalThis.fetch(`${agentBase}/regen`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${agentToken ?? ''}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error(`Agent responded ${res.status}`);
        }

        mutate();
        toaster.show('KI fertig — Post aktualisiert', 'success');
      } catch (err) {
        toaster.show('KI-Fehler — bitte erneut versuchen', 'warning');
        throw err;
      } finally {
        setRegenDone();
      }
    },
    [mutate, toaster, setRegenActive, setRegenDone]
  );

  return { updateDate, updateContent, schedulePost, triggerRegen };
}
