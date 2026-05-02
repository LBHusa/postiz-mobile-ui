'use client';

import type { FC } from 'react';
import { useState, useCallback } from 'react';
import clsx from 'clsx';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import type { Proposal } from '@gitroom/frontend/hooks/use-proposals';

interface ProposalCardProps {
  proposal: Proposal;
  onAccept: (proposal: Proposal) => void;
  onRegenerate: (id: string, feedback: string) => void;
  onReject: (group: string) => void;
}

export const ProposalCard: FC<ProposalCardProps> = ({
  proposal,
  onAccept,
  onRegenerate,
  onReject,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  const dateLabel = newDayjs(`${proposal.suggested_date}T${proposal.suggested_time}`).format('dd D. MMM · HH:mm');

  const handleRegenerate = useCallback(() => {
    if (!feedback.trim()) return;
    onRegenerate(proposal.id, feedback.trim());
    setFeedback('');
    setShowFeedback(false);
  }, [proposal.id, feedback, onRegenerate]);

  return (
    <div
      data-testid="proposal-card"
      data-proposal-id={proposal.id}
      className="rounded-xl border border-newBorder bg-newBgColorInner flex flex-col"
    >
      {/* Collapsed header */}
      <button
        type="button"
        data-testid="proposal-card-toggle"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3 py-3 flex items-start justify-between gap-2 active:opacity-70 transition-opacity"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-textItemBlur font-medium">{dateLabel}</span>
            <span className="text-[10px] text-textItemBlur capitalize">{proposal.platform}</span>
            <span className="text-[10px] text-textItemBlur">{proposal.funnel_stage}</span>
          </div>
          <p className="text-sm font-medium text-newTextColor leading-snug">{proposal.title}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-[10px] text-textItemBlur">{proposal.media_format}</span>
            <span className="text-[10px] text-textItemBlur">· {proposal.pillar}</span>
          </div>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={clsx('flex-shrink-0 mt-1 text-textItemBlur transition-transform', expanded && 'rotate-180')}
        >
          <polyline points="2 5 7 10 12 5" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-3 border-t border-newBorder pt-3">
          {/* Content outline */}
          {proposal.content_outline.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-textItemBlur uppercase tracking-wide">Inhalt</span>
              {proposal.content_outline.map((bullet, i) => (
                <p key={i} className="text-xs text-newTextColor leading-snug">• {bullet}</p>
              ))}
            </div>
          )}

          {/* Media */}
          {proposal.media_description && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-textItemBlur uppercase tracking-wide">Medium</span>
              <p className="text-xs text-newTextColor leading-snug">{proposal.media_description}</p>
            </div>
          )}

          {/* Data basis */}
          {proposal.data_basis.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-textItemBlur uppercase tracking-wide">Datenbasis</span>
              {proposal.data_basis.map((d, i) => (
                <p key={i} className="text-xs text-textItemBlur leading-snug">↳ {d}</p>
              ))}
            </div>
          )}

          {/* Feedback input for "Anders" */}
          {showFeedback && (
            <div className="flex flex-col gap-2">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Was soll anders werden?"
                rows={3}
                className="w-full rounded-lg border border-newBorder bg-newBgColor px-3 py-2 text-sm text-newTextColor resize-none outline-none placeholder:text-textItemBlur focus:border-btnPrimary transition-colors"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={!feedback.trim()}
                  className={clsx(
                    'flex-1 rounded-lg bg-btnPrimary text-white py-2 text-xs font-semibold transition-opacity',
                    !feedback.trim() ? 'opacity-40' : 'active:opacity-80'
                  )}
                >
                  Neu generieren
                </button>
                <button
                  type="button"
                  onClick={() => { setShowFeedback(false); setFeedback(''); }}
                  className="px-3 rounded-lg border border-newBorder text-xs text-textItemBlur active:opacity-60"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!showFeedback && (
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="proposal-accept"
                onClick={() => onAccept(proposal)}
                className="flex-1 rounded-lg bg-btnPrimary text-white py-2 text-xs font-semibold active:opacity-80 transition-opacity"
              >
                ✓ Annehmen
              </button>
              <button
                type="button"
                data-testid="proposal-regenerate"
                onClick={() => setShowFeedback(true)}
                className="flex-1 rounded-lg border border-newBorder bg-newBgColor text-xs text-newTextColor py-2 active:opacity-60 transition-opacity"
              >
                ↻ Anders
              </button>
              <button
                type="button"
                data-testid="proposal-reject"
                onClick={() => onReject(proposal.group)}
                className="px-3 rounded-lg border border-newBorder bg-newBgColor text-xs text-textItemBlur py-2 active:opacity-60 transition-opacity"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
