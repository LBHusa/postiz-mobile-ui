// Stub hook — Phase 6 replaces with real GET /api/proposals?status=pending calls.
export interface MobileProposal {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  platform: string;
  bullets: string[];
}

const STUB_PROPOSALS: MobileProposal[] = [
  {
    id: 'stub-1',
    date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    time: '11:00',
    title: 'Diagnose vs. Symptom — warum wir oft am falschen Problem arbeiten',
    platform: 'linkedin',
    bullets: [
      'MOFU-Inhalt: Bauen-scheitern-weiter Säule',
      'Hand-Gesten Bild (+18% Engagement)',
      'MOFU 21 Tage nicht bedient',
    ],
  },
];

export function useMobileProposals() {
  return { proposals: STUB_PROPOSALS };
}
