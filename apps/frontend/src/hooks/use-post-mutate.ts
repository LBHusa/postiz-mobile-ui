'use client';

import { useCallback } from "react";
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import type { PostMedia } from '@gitroom/frontend/hooks/use-post-detail';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';

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
            tags: [] as any[],
            posts: [
              {
                integration: { id: integrationId },
                value: [{ content: 'Entwurf', image: [] }],
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
        const first = Array.isArray(data) ? data[0] : data;
        const newId: string =
          first?.postId ?? first?.id ?? first?.posts?.[0]?.id ?? first?.group ?? '';
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

  const updateContent = useCallback(
    async (content: string): Promise<void> => {
      // Fetch current post via /posts/:id (returns { group, posts: [{ id, content, image, settings, integration }] })
      const res = await fetch(`/posts/${groupId}`);
      if (!res.ok) {
        toaster.show('Fehler beim Laden des Posts', 'warning');
        throw new Error(`updateContent: GET /posts/${groupId} → HTTP ${res.status}`);
      }
      const data = await res.json();
      const rawPosts: Array<any> = Array.isArray(data?.posts) ? data.posts : [];
      if (rawPosts.length === 0) {
        toaster.show('Fehler beim Laden des Posts', 'warning');
        throw new Error('updateContent: no posts');
      }

      const first = rawPosts[0];
      // Backend stores settings as JSON string with __type. Parse defensively.
      let parsedSettings: any = {};
      try {
        parsedSettings = typeof first.settings === 'string' ? JSON.parse(first.settings) : (first.settings ?? {});
      } catch {
        parsedSettings = {};
      }
      // Ensure __type set from integration.providerIdentifier as fallback.
      if (!parsedSettings.__type && first.integration?.providerIdentifier) {
        parsedSettings.__type = first.integration.providerIdentifier;
      }

      const updatePayload = {
        type: 'update',
        date: first.publishDate ?? new Date().toISOString(),
        shortLink: false,
        tags: [] as any[],
        posts: rawPosts.map((p: any, pi: number) => {
          let pSettings: any = {};
          try {
            pSettings = typeof p.settings === 'string' ? JSON.parse(p.settings) : (p.settings ?? {});
          } catch {
            pSettings = {};
          }
          if (!pSettings.__type && p.integration?.providerIdentifier) {
            pSettings.__type = p.integration.providerIdentifier;
          }
          return {
            group: p.group ?? data?.group ?? '',
            integration: { id: p.integration?.id },
            value: [
              {
                id: p.id,
                content: pi === 0 ? content : (p.content ?? ''),
                image: Array.isArray(p.image) ? p.image : [],
              },
            ],
            settings: pSettings,
          };
        }),
      };

      const updateRes = await fetch('/posts', {
        method: 'POST',
        body: JSON.stringify(updatePayload),
      });
      if (!updateRes.ok) {
        toaster.show('Fehler beim Speichern', 'warning');
        throw new Error(`updateContent: POST /posts → HTTP ${updateRes.status}`);
      }
      mutate();
      toaster.show('Gespeichert', 'success');
    },
    [groupId, fetch, mutate, toaster]
  );

  const updateMedia = useCallback(
    async (images: PostMedia[]) => {
      const res = await fetch(`/posts/${groupId}`);
      if (!res.ok) {
        toaster.show('Fehler beim Laden des Posts', 'warning');
        throw new Error(`updateMedia: GET /posts/${groupId} → HTTP ${res.status}`);
      }
      const data = await res.json();
      const rawPosts: Array<any> = Array.isArray(data?.posts) ? data.posts : [];
      if (rawPosts.length === 0) {
        toaster.show('Fehler beim Laden des Posts', 'warning');
        throw new Error('updateMedia: no posts');
      }

      const updatePayload = {
        type: 'update',
        date: rawPosts[0].publishDate ?? new Date().toISOString(),
        shortLink: false,
        tags: [] as any[],
        posts: rawPosts.map((p: any) => {
          let pSettings: any = {};
          try {
            pSettings = typeof p.settings === 'string' ? JSON.parse(p.settings) : (p.settings ?? {});
          } catch {
            pSettings = {};
          }
          if (!pSettings.__type && p.integration?.providerIdentifier) {
            pSettings.__type = p.integration.providerIdentifier;
          }
          return {
            group: p.group ?? data?.group ?? '',
            integration: { id: p.integration?.id },
            value: [
              {
                id: p.id,
                content: p.content ?? '',
                image: images,
              },
            ],
            settings: pSettings,
          };
        }),
      };

      const updateRes = await fetch('/posts', {
        method: 'POST',
        body: JSON.stringify(updatePayload),
      });
      if (!updateRes.ok) {
        toaster.show('Fehler beim Speichern der Medien', 'warning');
        throw new Error(`updateMedia: POST /posts → HTTP ${updateRes.status}`);
      }
      mutate();
      toaster.show('Medien gespeichert', 'success');
    },
    [groupId, fetch, mutate, toaster]
  );

  const updateStatus = useCallback(
    async (mobileStatus: MobileStatus): Promise<void> => {
      // online and failed are system-managed — cannot be set by user
      if (mobileStatus === "online" || mobileStatus === "failed") return;
      // scheduled is only set via the Planen button (with an explicit future date) — no-op here
      if (mobileStatus === "scheduled") return;

      // All remaining states (draft, idea, re_gen, approved, proposal) map to DRAFT in Postiz
      const res = await fetch(`/posts/${groupId}`);
      if (!res.ok) {
        toaster.show("Fehler beim Laden des Posts", "warning");
        throw new Error(`updateStatus: GET /posts/${groupId} → HTTP ${res.status}`);
      }
      const data = await res.json();
      const rawPosts: Array<any> = Array.isArray(data?.posts) ? data.posts : [];
      if (rawPosts.length === 0) {
        toaster.show("Fehler beim Laden des Posts", "warning");
        throw new Error("updateStatus: no posts");
      }

      const first = rawPosts[0];
      let parsedSettings: any = {};
      try {
        parsedSettings = typeof first.settings === "string" ? JSON.parse(first.settings) : (first.settings ?? {});
      } catch {
        parsedSettings = {};
      }
      if (!parsedSettings.__type && first.integration?.providerIdentifier) {
        parsedSettings.__type = first.integration.providerIdentifier;
      }

      const payload = {
        type: "draft" as const,
        date: first.publishDate ?? new Date().toISOString(),
        shortLink: false,
        tags: [] as any[],
        posts: rawPosts.map((p: any) => {
          let pSettings: any = {};
          try {
            pSettings = typeof p.settings === "string" ? JSON.parse(p.settings) : (p.settings ?? {});
          } catch {
            pSettings = {};
          }
          if (!pSettings.__type && p.integration?.providerIdentifier) {
            pSettings.__type = p.integration.providerIdentifier;
          }
          return {
            group: p.group ?? data?.group ?? "",
            integration: { id: p.integration?.id },
            value: [
              {
                id: p.id,
                content: p.content ?? "",
                image: Array.isArray(p.image) ? p.image : [],
              },
            ],
            settings: pSettings,
          };
        }),
      };

      const updateRes = await fetch("/posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!updateRes.ok) {
        toaster.show("Fehler beim Speichern des Status", "warning");
        throw new Error(`updateStatus: POST /posts → HTTP ${updateRes.status}`);
      }
      toaster.show("Status gespeichert", "success");
      mutate();
    },
    [groupId, fetch, mutate, toaster]
  );

  // Schedule a post (DRAFT or QUEUE) at the given date → sets state to QUEUE.
  // Uses POST /posts with type:'schedule' which always sets state=QUEUE regardless of current state.
  // PUT /posts/:id/date with action:'schedule' is a no-op for DRAFT posts (backend bug).
  const schedulePost = useCallback(
    async (date: string) => {
      // Sicherheits-Check: KEIN Schedule auf Vergangenheits-Datum (Postiz-Workflow published sonst sofort).
      const targetMs = new Date(date).getTime();
      if (Number.isNaN(targetMs) || targetMs <= Date.now() + 60_000) {
        toaster.show(
          'Datum liegt in Vergangenheit (oder zu nah an jetzt). Schedule abgelehnt.',
          'warning'
        );
        throw new Error('schedulePost: date must be at least 1 minute in the future');
      }
      const res = await fetch(`/posts/${groupId}`);
      if (!res.ok) {
        toaster.show('Fehler beim Laden des Posts', 'warning');
        throw new Error(`schedulePost: GET /posts/${groupId} → HTTP ${res.status}`);
      }
      const data = await res.json();
      const rawPosts: Array<any> = Array.isArray(data?.posts) ? data.posts : [];
      if (rawPosts.length === 0) {
        toaster.show('Fehler beim Laden des Posts', 'warning');
        throw new Error('schedulePost: no posts');
      }

      const scheduledDate = newDayjs(date).utc().format();

      const payload = {
        type: 'schedule' as const,
        date: scheduledDate,
        shortLink: false,
        tags: [] as any[],
        posts: rawPosts.map((p: any) => {
          let pSettings: any = {};
          try {
            pSettings = typeof p.settings === 'string' ? JSON.parse(p.settings) : (p.settings ?? {});
          } catch {
            pSettings = {};
          }
          if (!pSettings.__type && p.integration?.providerIdentifier) {
            pSettings.__type = p.integration.providerIdentifier;
          }
          return {
            group: p.group ?? data?.group ?? '',
            integration: { id: p.integration?.id },
            value: [
              {
                id: p.id,
                content: p.content ?? '',
                image: Array.isArray(p.image) ? p.image : [],
              },
            ],
            settings: pSettings,
          };
        }),
      };

      const updateRes = await fetch('/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!updateRes.ok) {
        toaster.show('Fehler beim Einplanen', 'warning');
        throw new Error(`schedulePost: POST /posts → HTTP ${updateRes.status}`);
      }
      toaster.show('Post eingeplant', 'success');
      mutate();
    },
    [groupId, fetch, mutate, toaster]
  );

  // Re-Gen wurde entfernt — Workflow läuft autonom als content-publishing Skill auf Server 77.
  const triggerRegen = useCallback(
    async (_postId: string, _feedback?: string) => {
      toaster.show('Re-Gen läuft autonom auf dem Server', 'success');
    },
    [toaster]
  );

  // Persistiert Notiz-Feld (Postiz description-Spalte). Geht via type='update' Endpoint.
  // Wird vom content-publishing Skill auf Server 77 als Hinweis (z.B. KI-Vorlage) gelesen.
  const updateDescription = useCallback(
    async (description: string): Promise<void> => {
      const res = await fetch(`/posts/${groupId}`);
      if (!res.ok) {
        toaster.show('Fehler beim Laden des Posts', 'warning');
        throw new Error(`updateDescription: GET /posts/${groupId} → HTTP ${res.status}`);
      }
      const data = await res.json();
      const rawPosts: Array<any> = Array.isArray(data?.posts) ? data.posts : [];
      if (rawPosts.length === 0) return;
      const first = rawPosts[0];
      let parsedSettings: any = {};
      try {
        parsedSettings = typeof first.settings === 'string' ? JSON.parse(first.settings) : (first.settings ?? {});
      } catch {
        parsedSettings = {};
      }
      if (!parsedSettings.__type && first.integration?.providerIdentifier) {
        parsedSettings.__type = first.integration.providerIdentifier;
      }
      const payload = {
        type: 'update',
        date: first.publishDate ?? new Date().toISOString(),
        shortLink: false,
        description,
        tags: [] as any[],
        posts: rawPosts.map((p: any) => ({
          group: p.group ?? data?.group ?? '',
          integration: { id: p.integration?.id },
          value: [
            {
              id: p.id,
              content: p.content ?? '',
              image: Array.isArray(p.image) ? p.image : [],
            },
          ],
          settings: parsedSettings,
        })),
      };
      const updateRes = await fetch('/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!updateRes.ok) {
        toaster.show('Fehler beim Speichern der Notiz', 'warning');
        throw new Error(`updateDescription: POST /posts → HTTP ${updateRes.status}`);
      }
      mutate();
    },
    [groupId, fetch, mutate, toaster]
  );

  return { updateDate, updateContent, updateMedia, updateStatus, updateDescription, schedulePost, triggerRegen };
}
