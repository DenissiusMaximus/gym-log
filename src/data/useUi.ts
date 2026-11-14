import { create } from 'zustand';

import { todayStr } from '../lib/date';
import type { PersistStatus } from './types';

export type SwStatus =
  | 'unsupported'
  | 'localhost'
  | 'registering'
  | 'installing'
  | 'waiting'
  | 'active'
  | 'error';

export type SnackbarMessage = {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  bottomOffset?: number;
};

export type SnackbarOptions = {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds; defaults to 5000. */
  duration?: number;
  /** Extra distance above the bottom safe area (dp), for example above a FAB or the entry panel. */
  bottomOffset?: number;
};

type UiState = {
  today: string;
  persistStatus: PersistStatus;
  updateReady: boolean;
  swStatus: SwStatus;
  snackbar: SnackbarMessage | null;
  refreshToday: () => void;
  setPersistStatus: (status: PersistStatus) => void;
  setUpdateReady: (ready: boolean) => void;
  setSwStatus: (status: SwStatus) => void;
  showSnackbar: (options: SnackbarOptions) => void;
  dismissSnackbar: () => void;
};

let snackbarSeq = 0;
let snackbarTimer: ReturnType<typeof setTimeout> | null = null;

/** Non-persisted UI state. Later stages add selection, dialogs and the chart period here. */
export const useUi = create<UiState>()((set, get) => ({
  today: todayStr(),
  persistStatus: 'ok',
  updateReady: false,
  swStatus: 'registering',
  snackbar: null,
  refreshToday: () => {
    const today = todayStr();
    if (today !== get().today) set({ today });
  },
  setPersistStatus: (persistStatus) => set({ persistStatus }),
  setUpdateReady: (updateReady) => set({ updateReady }),
  setSwStatus: (swStatus) => set({ swStatus }),
  // One snackbar at a time: a new one replaces the old one.
  showSnackbar: ({ text, actionLabel, onAction, duration = 5000, bottomOffset }) => {
    if (snackbarTimer) clearTimeout(snackbarTimer);
    const id = ++snackbarSeq;
    set({ snackbar: { id, text, actionLabel, onAction, bottomOffset } });
    snackbarTimer = setTimeout(() => {
      if (get().snackbar?.id === id) set({ snackbar: null });
    }, duration);
  },
  dismissSnackbar: () => {
    if (snackbarTimer) clearTimeout(snackbarTimer);
    snackbarTimer = null;
    set({ snackbar: null });
  },
}));
