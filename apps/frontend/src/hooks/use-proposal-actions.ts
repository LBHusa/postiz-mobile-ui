'use client';

import { useCallback } from 'react';
import { useToaster } from '@gitroom/react/toaster/toaster';

export function useProposalActions(mutate: () => void) {
  const toaster = useToaster();
  const agentBase = process.env.NEXT_PUBLIC_HUSATECH_AGENT_BASE_URL ?? '';
  const agentToken = process.env.NEXT_PUBLIC_HUSATECH_AGENT_TOKEN ?? '';

  const post = useCallback(
    async (path: string, body?: object) => {
      const res = await globalThis.fetch(`${agentBase}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agentToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`Agent ${path} responded ${res.status}`);
    },
    [agentBase, agentToken]
  );

  const acceptProposal = useCallback(
    async (id: string) => {
      try {
        await post(`/proposals/${id}/accept`);
        mutate();
        toaster.show('Vorschlag angenommen — Entwurf erstellt', 'success');
      } catch {
        toaster.show('Fehler beim Annehmen', 'warning');
      }
    },
    [post, mutate, toaster]
  );

  const regenerateProposal = useCallback(
    async (id: string, feedback: string) => {
      try {
        await post(`/proposals/${id}/regenerate`, { feedback });
        mutate();
        toaster.show('Neu generiert', 'success');
      } catch {
        toaster.show('Fehler beim Neu-Generieren', 'warning');
      }
    },
    [post, mutate, toaster]
  );

  const rejectProposal = useCallback(
    async (id: string) => {
      try {
        await post(`/proposals/${id}/reject`);
        mutate();
        toaster.show('Vorschlag verworfen', 'success');
      } catch {
        toaster.show('Fehler beim Verwerfen', 'warning');
      }
    },
    [post, mutate, toaster]
  );

  const generateProposals = useCallback(
    async (weeksAhead: number, options: { avoidExisting: boolean; ensureDiversity: boolean; preferUnusedPillars: boolean }) => {
      try {
        await post('/proposals/generate', { weeks_ahead: weeksAhead, options });
        mutate();
        toaster.show(`${weeksAhead * 4} Vorschläge werden generiert…`, 'success');
      } catch {
        toaster.show('Fehler beim Generieren', 'warning');
      }
    },
    [post, mutate, toaster]
  );

  return { acceptProposal, regenerateProposal, rejectProposal, generateProposals };
}
