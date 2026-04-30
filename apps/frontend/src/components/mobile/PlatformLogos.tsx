import type { FC } from 'react';
import type { Integrations } from '@gitroom/frontend/components/launches/calendar.context';

interface PlatformLogosProps {
  integrations: Integrations[];
  size?: number;
  max?: number;
}

export const PlatformLogos: FC<PlatformLogosProps> = ({
  integrations,
  size = 16,
  max = 3,
}) => {
  const visible = integrations.slice(0, max);
  const overflow = integrations.length - max;

  return (
    <span className="flex items-center gap-0.5">
      {visible.map((integration) => (
        <img
          key={integration.id}
          data-testid="platform-logo"
          src={integration.picture}
          alt={integration.name}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ))}
      {overflow > 0 && (
        <span
          className="text-textItemBlur"
          style={{ fontSize: size * 0.7, lineHeight: 1 }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
};
