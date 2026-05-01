'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import { useProposals } from '@gitroom/frontend/hooks/use-proposals';
import { useProposalActions } from '@gitroom/frontend/hooks/use-proposal-actions';
import { ProposalCard } from './ProposalCard';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

interface ProposalsInboxProps {
  onGeneratePress: () => void;
}

export const ProposalsInbox: FC<ProposalsInboxProps> = ({ onGeneratePress }) => {
  const { data: proposals = [], mutate, isLoading } = useProposals('pending');
  const { acceptProposal, regenerateProposal, rejectProposal } = useProposalActions(mutate);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof proposals>();
    for (const p of proposals) {
      const existing = map.get(p.week_iso) ?? [];
      existing.push(p);
      map.set(p.week_iso, existing);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [proposals]);

  return (
    <div data-testid="proposals-inbox" className="flex flex-col h-full">
      {/* Sticky header with generate button */}
      <div className="sticky top-0 z-10 bg-newBgColor border-b border-newBorder px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-newTextColor">
          {proposals.length > 0
            ? `${proposals.length} Vorschlag${proposals.length !== 1 ? 'e' : ''}`
            : 'Keine Vorschläge'}
        </span>
        <button
          type="button"
          data-testid="proposals-generate-trigger"
          onClick={onGeneratePress}
          className="rounded-lg bg-btnPrimary px-3 py-1.5 text-xs font-semibold text-white active:opacity-80 transition-opacity"
        >
          + Generieren
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div data-testid="proposals-loading" className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-newBgColorInner border border-newBorder animate-pulse"
              />
            ))}
          </div>
        )}

        {!isLoading && proposals.length === 0 && (
          <div
            data-testid="proposals-empty"
            className="flex flex-col items-center justify-center gap-3 py-16 text-center"
          >
            <span className="text-4xl">✦</span>
            <p className="text-sm font-medium text-newTextColor">Noch keine Vorschläge</p>
            <p className="text-xs text-textItemBlur max-w-[220px]">
              Tippe auf "Generieren", um KI-Vorschläge für die nächsten Wochen zu erstellen.
            </p>
            <button
              type="button"
              onClick={onGeneratePress}
              className="mt-2 rounded-xl bg-btnPrimary px-4 py-2 text-sm font-semibold text-white active:opacity-80 transition-opacity"
            >
              Jetzt generieren
            </button>
          </div>
        )}

        {!isLoading && grouped.length > 0 && (
          <div className="flex flex-col gap-6">
            {grouped.map(([weekIso, weekProposals]) => {
              const weekLabel = weekIso
                ? `KW ${newDayjs(weekIso).isoWeek()} · ${newDayjs(weekIso).year()}`
                : weekIso;
              return (
                <div key={weekIso} className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-textItemBlur uppercase tracking-wide">
                    {weekLabel}
                  </span>
                  {weekProposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onAccept={acceptProposal}
                      onRegenerate={regenerateProposal}
                      onReject={rejectProposal}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
