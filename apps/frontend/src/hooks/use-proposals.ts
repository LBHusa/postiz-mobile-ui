'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface Proposal {
  id: string;
  week_iso: string;
  suggested_date: string; // YYYY-MM-DD
  suggested_time: string; // HH:mm
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

export function useProposals(status: ProposalStatus = 'pending') {
  const agentBase = process.env.NEXT_PUBLIC_HUSATECH_AGENT_BASE_URL ?? '';
  const agentToken = process.env.NEXT_PUBLIC_HUSATECH_AGENT_TOKEN ?? '';

  const fetcher = useCallback(async (): Promise<Proposal[]> => {
    if (!agentBase) return [];
    const res = await globalThis.fetch(`${agentBase}/proposals?status=${status}`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    if (!res.ok) return [];
    return res.json();
  }, [agentBase, agentToken, status]);

  return useSWR(`/proposals?status=${status}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });
}
