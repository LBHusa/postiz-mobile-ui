'use client';

import { useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

/**
 * Mutation hook for a single post group.
 *
 * IMPORTANT — Body-Update Architecture:
 * Postiz internal API has NO direct `PUT /posts/:id` for body updates. The only way
 * to mutate a post body is via `POST /posts` with `type='update'` plus the full
 * post-group payload (all integrations + all value items). This is non-trivial from
 * the frontend because it requires the full post structure including per-integration
 * value arrays.
 *
 * Architecture decision (Phase 3, 30.04.2026):
 * The mobile-UI does NOT directly POST body updates. Instead, the Husatech
 * Server-Agent (Phase 5) handles all body mutations via Postiz Public-API. The
 * mobile-UI only:
 *  - reads posts via GET /posts/:id (handled by use-post-detail.ts)
 *  - updates date/schedule via PUT /posts/:id/date (functional below)
 *  - triggers re-gen via POST agent.husatech.de/regen (Phase 5)
 *  - publishes via PUT /posts/:id/date with action='schedule' (functional below)
 *
 * `updateContent` below is a deliberate Phase-3 stub that surfaces the limitation
 * to the user. Phase 5 wires the real flow via the Server-Agent.
 */
export function usePostMutate(groupId: string, mutate: () => void) {
  const fetch = useFetch();
  const toaster = useToaster();

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

  /**
   * Phase-3 stub: body mutations are NOT persisted to Postiz from the mobile UI.
   * Phase 5 wires the Server-Agent which performs the actual update via
   * `POST /public/v1/posts type='update'` with full post-group payload.
   *
   * Until Phase 5: this returns without persisting. Caller's optimistic UI state
   * remains until the next `mutate()` (which re-fetches and reverts unsaved changes).
   * This is correct behavior — the user sees their typed text, but it is not saved
   * until either (a) Phase 5 server-agent flow is wired, or (b) the post is
   * scheduled/published which goes through a different code path.
   *
   * Throws to allow callers to handle rollback consistently with future Phase-5
   * behavior (where this WILL throw on agent unreachable).
   */
  const updateContent = useCallback(
    async (_content: string): Promise<void> => {
      // Phase-5 placeholder: no-op + informational toast.
      toaster.show(
        'Body-Speichern via Server-Agent ist Phase 5 — vorerst ungespeichert',
        'warning'
      );
      // Signal "no persistence happened" to caller so optimistic UI can roll back if needed.
      throw new Error('updateContent: Phase-5 stub — body persistence not yet wired');
    },
    [toaster]
  );

  /**
   * Schedule a draft post at its current publishDate.
   * Uses the only available state-transition endpoint: PUT /posts/:id/date with action='schedule'.
   */
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

  return { updateDate, updateContent, schedulePost };
}
