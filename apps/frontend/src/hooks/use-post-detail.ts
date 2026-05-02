'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import type { Integrations } from '@gitroom/frontend/components/launches/calendar.context';

export interface PostMedia {
  id: string;
  path: string;
  thumbnail?: string;
}

export interface PostValue {
  id: string;
  content: string;
  media: PostMedia[];
}

export interface PostNotes {
  note: string;
  imageNotes: Record<string, string>;
}

export interface PostDetail {
  id: string;
  group: string;
  publishDate: string;
  state: string;
  integration: Integrations;
  value: PostValue[];
  description: string;
  notes: PostNotes;
  // title is stored as first line of the first value's content
}

// Description-Feld in Postiz speichert strukturierte Notes als JSON.
// Falls Legacy-Free-Text drin ist, wandern die ins note-Feld.
export function parsePostNotes(description: string | null | undefined): PostNotes {
  if (!description) return { note: '', imageNotes: {} };
  const trimmed = description.trim();
  if (!trimmed.startsWith('{')) return { note: description, imageNotes: {} };
  try {
    const data = JSON.parse(trimmed);
    return {
      note: typeof data?.note === 'string' ? data.note : '',
      imageNotes: data?.imageNotes && typeof data.imageNotes === 'object' ? data.imageNotes : {},
    };
  } catch {
    return { note: description, imageNotes: {} };
  }
}

export function serializePostNotes(notes: PostNotes): string {
  // Wenn nichts gesetzt: leerer String, damit Backend nicht unnoetig speichert
  if (!notes.note && Object.keys(notes.imageNotes).length === 0) return '';
  return JSON.stringify({ note: notes.note, imageNotes: notes.imageNotes });
}

export function usePostDetail(postId: string) {
  const fetch = useFetch();

  const load = useCallback(async () => {
    const data = await (await fetch(`/posts/${postId}`)).json();
    // Backend returns { posts: [{ id, content, image, group, integration, ... }] }.
    // Adapt to PostDetail shape: each backend post becomes a PostValue entry under value[].
    const rawPosts = Array.isArray(data?.posts) ? data.posts : [];
    if (!rawPosts.length) return null;
    const first = rawPosts[0];
    const adapted: PostDetail = {
      id: first.id,
      group: first.group ?? data?.group ?? '',
      publishDate: first.publishDate,
      state: first.state,
      integration: first.integration,
      description: first.description ?? '',
      notes: parsePostNotes(first.description),
      value: rawPosts.map((p: any) => ({
        id: p.id,
        content: p.content ?? '',
        media: Array.isArray(p.image) ? p.image : [],
      })),
    };
    return adapted;
  }, [postId]);

  return useSWR(`/posts/${postId}`, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });
}
