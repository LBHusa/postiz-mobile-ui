'use client';

import type { FC } from 'react';
import { useCallback, useState } from 'react';
import { PlatformCard } from './PlatformCard';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import type { Integrations } from '@gitroom/frontend/components/launches/calendar.context';

interface PlatformListProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export const PlatformList: FC<PlatformListProps> = ({ selectedIds, onSelectionChange }) => {
  const { data: integrations = [] } = useIntegrationList();
  const [formats, setFormats] = useState<Record<string, string>>({});

  const active = (integrations as Integrations[]).filter((i) => !i.disabled);

  const handleToggle = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onSelectionChange(selectedIds.filter((sid) => sid !== id));
      } else {
        onSelectionChange([...selectedIds, id]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const handleFormatChange = useCallback((id: string, format: string) => {
    setFormats((prev) => ({ ...prev, [id]: format }));
  }, []);

  return (
    <div data-testid="platform-list" className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-textItemBlur uppercase tracking-wide px-0.5">
        Plattformen
      </h3>
      {active.map((integration: Integrations) => (
        <PlatformCard
          key={integration.id}
          integration={integration}
          selected={selectedIds.includes(integration.id)}
          format={formats[integration.id] ?? 'post'}
          onToggle={handleToggle}
          onFormatChange={handleFormatChange}
        />
      ))}
      {active.length === 0 && (
        <p className="text-xs text-textItemBlur text-center py-4">
          Keine Plattformen verbunden
        </p>
      )}
    </div>
  );
};
