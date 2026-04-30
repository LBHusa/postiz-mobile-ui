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

export interface PostDetail {
  id: string;
  group: string;
  publishDate: string;
  state: string;
  integration: Integrations;
  value: PostValue[];
  // title is stored as first line of the first value's content
}

export function usePostDetail(postId: string) {
  const fetch = useFetch();

  const load = useCallback(async () => {
    const data = await (await fetch(`/posts/group/${postId}`)).json();
    // API returns { posts: [...] } — take first post as the canonical one
    return (data?.posts?.[0] ?? null) as PostDetail | null;
  }, [postId]);

  return useSWR(`/posts/group/${postId}`, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });
}
