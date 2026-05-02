'use client';

import { useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

export function useProposalActions(mutate: () => void) {
  const fetch = useFetch();
  const toaster = useToaster();

  const acceptProposal = useCallback(
    async (group: string, publishDate: string) => {
      try {
        const res = await fetch(`/posts/${group}/date`, {
          method: 'PUT',
          body: JSON.stringify({
            date: newDayjs(publishDate).utc().format(),
            action: 'schedule',
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toaster.show('Vorschlag angenommen', 'success');
        mutate();
      } catch {
        toaster.show('Fehler beim Annehmen', 'warning');
      }
    },
    [fetch, toaster, mutate]
  );

  const rejectProposal = useCallback(
    async (group: string) => {
      try {
        const res = await fetch(`/posts/${group}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toaster.show('Vorschlag abgelehnt', 'success');
        mutate();
      } catch {
        toaster.show('Fehler beim Ablehnen', 'warning');
      }
    },
    [fetch, toaster, mutate]
  );

  const regenerateProposal = useCallback(
    async (_id: string, _feedback: string) => {
      toaster.show('Neu-Generierung läuft autonom auf dem Server', 'success');
    },
    [toaster]
  );

  const generateProposals = useCallback(
    async (
      _weeksAhead: number,
      _options: { avoidExisting: boolean; ensureDiversity: boolean; preferUnusedPillars: boolean }
    ) => {
      toaster.show('Vorschläge werden vom Server-Skill autonom geschrieben', 'success');
    },
    [toaster]
  );

  return { acceptProposal, regenerateProposal, rejectProposal, generateProposals };
}
