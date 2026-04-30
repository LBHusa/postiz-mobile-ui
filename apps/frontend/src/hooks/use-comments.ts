'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

export interface PostComment {
  id: string;
  content: string;
  type: 'page' | 'media' | 'inline';
  mediaId?: string;
  anchor?: string;
  createdAt: string;
  user?: { name: string; picture: string };
}

export function useComments(publishDate: string) {
  const fetch = useFetch();
  const dateKey = newDayjs(publishDate).utc().format('YYYY-MM-DDTHH:mm:00');

  const load = useCallback(async () => {
    const data = await (await fetch(`/comments/${dateKey}`)).json();
    return (data ?? []) as PostComment[];
  }, [dateKey]);

  const { data: comments = [], mutate } = useSWR(`/comments-${dateKey}`, load, {
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  const addComment = useCallback(
    async (content: string, type: PostComment['type'] = 'page', mediaId?: string) => {
      await fetch('/comments', {
        method: 'POST',
        body: JSON.stringify({ content, date: dateKey, type, mediaId }),
      });
      mutate();
    },
    [dateKey, fetch, mutate]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      await fetch(`/comments/${commentId}`, { method: 'DELETE' });
      mutate();
    },
    [fetch, mutate]
  );

  return { comments, addComment, deleteComment, mutate };
}
