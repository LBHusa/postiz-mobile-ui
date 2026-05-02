'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface Proposal {
  id: string;
  group: string;
  week_iso: string;
  suggested_date: string;
  suggested_time: string;
  title: string;
  content_outline: string[];
  media_description: string;
  media_format: string;
  platform: string;
  pillar: string;
  funnel_stage: string;
  data_basis: string[];
  status: ProposalStatus;
  accepted_postiz_id?: string;
}

const VORSCHLAG_TAG = 'vorschlag';

function mapPostizStateToProposalStatus(state: string): ProposalStatus {
  if (state === 'DRAFT') return 'pending';
  if (state === 'QUEUE' || state === 'PUBLISHED') return 'accepted';
  return 'rejected';
}

export function useProposals(status: ProposalStatus = 'pending') {
  const fetch = useFetch();

  return useSWR<Proposal[]>(`proposals-postiz-${status}`, async () => {
    const res = await fetch('/posts/list?limit=100&page=0');
    if (!res.ok) return [];
    const data = await res.json();
    const rawPosts: Array<any> = Array.isArray(data?.posts) ? data.posts : [];

    return rawPosts
      .filter((p) => p.tags?.some((t: any) => t.tag?.name === VORSCHLAG_TAG))
      .filter((p) => mapPostizStateToProposalStatus(p.state) === status)
      .map((p): Proposal => {
        const date = new Date(p.publishDate);
        const isoDate = date.toISOString().slice(0, 10);
        const isoTime = date.toISOString().slice(11, 16);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + 1);
        const weekIso = weekStart.toISOString().slice(0, 10);

        return {
          id: p.id,
          group: p.group ?? p.id,
          week_iso: weekIso,
          suggested_date: isoDate,
          suggested_time: isoTime,
          title: p.content?.split('\n')[0]?.replace(/<[^>]+>/g, '') ?? '',
          content_outline: [p.content ?? ''],
          media_description: '',
          media_format: 'image',
          platform: p.integration?.providerIdentifier ?? '',
          pillar: '',
          funnel_stage: '',
          data_basis: ['Postiz-Draft mit Tag vorschlag'],
          status: mapPostizStateToProposalStatus(p.state),
          accepted_postiz_id: p.id,
        };
      });
  }, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
}
