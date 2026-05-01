'use client';

import { useMemo } from 'react';
import { useProposals } from '@gitroom/frontend/hooks/use-proposals';

export interface MobileProposal {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  platform: string;
  bullets: string[];
}

export function useMobileProposals() {
  const { data: proposals = [] } = useProposals('pending');

  const mobileProposals = useMemo<MobileProposal[]>(
    () =>
      proposals.map((p) => ({
        id: p.id,
        date: p.suggested_date,
        time: p.suggested_time,
        title: p.title,
        platform: p.platform,
        bullets: p.content_outline,
      })),
    [proposals]
  );

  return { proposals: mobileProposals };
}
