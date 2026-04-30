// Maps Postiz State enum → our 8 mobile status states.
// Phase 4: replace stub return with GET /api/workflow/states from server-agent.
export type MobileStatus =
  | 'idea'
  | 'draft'
  | 're_gen'
  | 'approved'
  | 'scheduled'
  | 'online'
  | 'failed'
  | 'proposal';

export interface StatusConfig {
  state: MobileStatus;
  label: string;
  color: string;
  symbol: string;
}

const STATUS_CONFIGS: StatusConfig[] = [
  { state: 'idea',      label: 'Idee',        color: '#999999', symbol: '○' },
  { state: 'draft',     label: 'Entwurf',     color: '#f59e0b', symbol: '●' },
  { state: 're_gen',    label: 'Re-Gen',      color: '#f59e0b', symbol: '↻' },
  { state: 'approved',  label: 'Freigegeben', color: '#60a5fa', symbol: '✓' },
  { state: 'scheduled', label: 'Geplant',     color: '#3b82f6', symbol: '📤' },
  { state: 'online',    label: 'Online',      color: '#22c55e', symbol: '🌍' },
  { state: 'failed',    label: 'Fehler',      color: '#ef4444', symbol: '⚠' },
  { state: 'proposal',  label: 'Vorschlag',   color: '#6b7280', symbol: '◌' },
];

// Postiz State → MobileStatus mapping
const POSTIZ_STATE_MAP: Record<string, MobileStatus> = {
  DRAFT:     'draft',
  QUEUE:     'scheduled',
  PUBLISHED: 'online',
  ERROR:     'failed',
};

export function mapPostizState(postizState: string): MobileStatus {
  return POSTIZ_STATE_MAP[postizState] ?? 'draft';
}

export function useStatusMapping() {
  return {
    configs: STATUS_CONFIGS,
    getConfig: (state: MobileStatus): StatusConfig =>
      STATUS_CONFIGS.find((c) => c.state === state) ?? STATUS_CONFIGS[1],
    mapPostizState,
  };
}
