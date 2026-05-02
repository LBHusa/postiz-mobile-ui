'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useToaster } from '@gitroom/react/toaster/toaster';

export interface PostComment {
  id: string;
  content: string;
  type: 'page' | 'media' | 'inline';
  mediaId?: string;
  anchor?: string;
  createdAt: string;
  user?: { name: string; picture: string };
}

// V2 stub: no backend comment endpoint exists in Postiz V1.
export function useComments(_publishDate: string) {
  const toaster = useToaster();

  const { data: comments = [] } = useSWR<PostComment[]>('comments-v2-stub', async () => [], {
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  const addComment = useCallback(
    async (_content: string, _type: PostComment['type'] = 'page', _mediaId?: string) => {
      toaster.show('Kommentare folgen in V2', 'warning');
    },
    [toaster]
  );

  const deleteComment = useCallback(
    async (_commentId: string) => {
      toaster.show('Kommentare folgen in V2', 'warning');
    },
    [toaster]
  );

  const mutate = useCallback(() => {}, []);

  return { comments, addComment, deleteComment, mutate };
}
