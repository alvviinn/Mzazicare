'use client';

import { createContext, useContext } from 'react';
import { Dashboard } from './types';

type DashCtx = { dash: Dashboard | null; error: string; reload: () => Promise<void> };

export const DashContext = createContext<DashCtx>({ dash: null, error: '', reload: async () => {} });

/** The family dashboard, loaded once for every page and refreshed every 10 seconds. */
export const useDashboard = () => useContext(DashContext);
