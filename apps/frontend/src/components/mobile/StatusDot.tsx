import type { FC } from 'react';
import type { MobileStatus } from '@gitroom/frontend/hooks/use-status-mapping';
import { useStatusMapping } from '@gitroom/frontend/hooks/use-status-mapping';

interface StatusDotProps {
  status: MobileStatus;
  size?: number;
}

export const StatusDot: FC<StatusDotProps> = ({ status, size = 8 }) => {
  const { getConfig } = useStatusMapping();
  const config = getConfig(status);
  const isProposal = status === 'proposal';
  const isReGen = status === 're_gen';

  return (
    <span
      data-testid="status-dot"
      data-status={status}
      className={isReGen ? 'animate-pulse' : undefined}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: isProposal ? 'transparent' : config.color,
        border: isProposal ? `1.5px dashed ${config.color}` : 'none',
        flexShrink: 0,
      }}
      aria-label={config.label}
    />
  );
};
