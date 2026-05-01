'use client';

import { useState } from 'react';
import { ProposalsInbox } from '@gitroom/frontend/components/mobile/ProposalsInbox';
import { ProposalGenerateSheet } from '@gitroom/frontend/components/mobile/ProposalGenerateSheet';
import { useProposals } from '@gitroom/frontend/hooks/use-proposals';
import { useProposalActions } from '@gitroom/frontend/hooks/use-proposal-actions';

export default function VorschlaegePage() {
  const [showGenerateSheet, setShowGenerateSheet] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { mutate } = useProposals('pending');
  const { generateProposals } = useProposalActions(mutate);

  const handleGenerate = async (
    weeksAhead: number,
    options: { avoidExisting: boolean; ensureDiversity: boolean; preferUnusedPillars: boolean }
  ) => {
    setGenerating(true);
    try {
      await generateProposals(weeksAhead, options);
    } finally {
      setGenerating(false);
      setShowGenerateSheet(false);
    }
  };

  return (
    <>
      <ProposalsInbox onGeneratePress={() => setShowGenerateSheet(true)} />

      {showGenerateSheet && (
        <ProposalGenerateSheet
          onGenerate={handleGenerate}
          onClose={() => setShowGenerateSheet(false)}
          isLoading={generating}
        />
      )}
    </>
  );
}
