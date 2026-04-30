'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface RegenState {
  active: boolean;
  postId: string | null;
}

interface RegenContextValue {
  regen: RegenState;
  setRegenActive: (postId: string) => void;
  setRegenDone: () => void;
}

export const RegenContext = createContext<RegenContextValue>({
  regen: { active: false, postId: null },
  setRegenActive: () => undefined,
  setRegenDone: () => undefined,
});

export function useRegenState() {
  return useContext(RegenContext);
}

export function useRegenStateValue(): RegenContextValue {
  const [regen, setRegen] = useState<RegenState>({ active: false, postId: null });

  const setRegenActive = useCallback((postId: string) => {
    setRegen({ active: true, postId });
  }, []);

  const setRegenDone = useCallback(() => {
    setRegen({ active: false, postId: null });
  }, []);

  return { regen, setRegenActive, setRegenDone };
}
