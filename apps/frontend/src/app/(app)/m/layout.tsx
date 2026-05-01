'use client';

import { type ReactNode, useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { usePathname } from 'next/navigation';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { MobileShell } from '@gitroom/frontend/components/mobile/MobileShell';
import { RegenContext, useRegenStateValue } from '@gitroom/frontend/hooks/use-regen-state';
import { useProposals } from '@gitroom/frontend/hooks/use-proposals';
import { useSearchParams } from 'next/navigation';
import type { User } from '@prisma/client';

type ContextUser = User & {
  orgId: string;
  tier: 'FREE' | 'STANDARD' | 'PRO' | 'ULTIMATE' | 'TEAM';
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  publicApi: string;
  totalChannels: number;
};

const ROUTE_TITLES: Record<string, string> = {
  '/m/kalender': 'Kalender',
  '/m/vorschlaege': 'Vorschläge',
  '/m/mehr': 'Mehr',
};

function MobileLayoutInner({ children, user, mutate }: { children: ReactNode; user: ContextUser; mutate: () => void }) {
  const searchParams = useSearchParams();
  const regenValue = useRegenStateValue();
  const pathname = usePathname();
  const { data: pendingProposals = [] } = useProposals('pending');

  const title = ROUTE_TITLES[pathname] ?? '';

  return (
    <ContextWrapper user={user}>
      <MantineWrapper>
        <Toaster />
        <RegenContext.Provider value={regenValue}>
          <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
            <PreConditionComponent />
            <MobileShell title={title} badgeCount={pendingProposals.length}>{children}</MobileShell>
          </CheckPayment>
        </RegenContext.Provider>
      </MantineWrapper>
    </ContextWrapper>
  );
}

export default function MobileLayout({ children }: { children: ReactNode }) {
  const fetch = useFetch();
  const load = useCallback(
    async (path: string) => {
      return await (await fetch(path)).json();
    },
    [fetch]
  );
  const { data: user, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <MobileLayoutInner user={user as ContextUser} mutate={mutate}>{children}</MobileLayoutInner>;
}
