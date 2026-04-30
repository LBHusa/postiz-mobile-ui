'use client';

import { type ReactNode, useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { MobileShell } from '@gitroom/frontend/components/mobile/MobileShell';
import { useSearchParams } from 'next/navigation';

export default function MobileLayout({ children }: { children: ReactNode }) {
  const fetch = useFetch();
  const searchParams = useSearchParams();
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

  return (
    <ContextWrapper user={user}>
      <MantineWrapper>
        <Toaster />
        <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
          <PreConditionComponent />
          <MobileShell title="Kalender">{children}</MobileShell>
        </CheckPayment>
      </MantineWrapper>
    </ContextWrapper>
  );
}
