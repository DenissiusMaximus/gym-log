import { create } from 'zustand';

import type { ChartPeriod } from '../features/chart/chartMath';
import { todayStr } from '../lib/date';
import { newId } from './ids';
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

/** The table cell the entry panel is editing. */
export type SelectedCell = { workoutId: string; exerciseId: string };

/**
 * Ids of the two virtual columns ("today" and "no date"). They are never stored: a workout with
 * the draft id appears in the data together with its first weight, then the id is renewed.
 */
export type DraftIds = { today: string; undated: string };

type UiState = {
  today: string;
  draftIds: DraftIds;
  selectedCell: SelectedCell | null;
  /** Period picked on the chart screen; `null` until the first pick (then a default applies). */
  chartPeriod: ChartPeriod | null;
  persistStatus: PersistStatus;
  updateReady: boolean;
  swStatus: SwStatus;
  snackbar: SnackbarMessage | null;
  refreshToday: () => void;
  /** Gives a draft a new id after its workout was created; does nothing if `id` is not a draft id. */
  renewDraftId: (id: string) => void;
  renewAllDraftIds: () => void;
  setSelectedCell: (cell: SelectedCell | null) => void;
  setChartPeriod: (period: ChartPeriod) => void;
  setPersistStatus: (status: PersistStatus) => void;
  setUpdateReady: (ready: boolean) => void;
  setSwStatus: (status: SwStatus) => void;
  showSnackbar: (options: SnackbarOptions) => void;
  dismissSnackbar: () => void;
};

let snackbarSeq = 0;
let snackbarTimer: ReturnType<typeof setTimeout> | null = null;

/** Non-persisted UI state: lives until the app is closed. */
export const useUi = create<UiState>()((set, get) => ({
  today: todayStr(),
  draftIds: { today: newId(), undated: newId() },
  selectedCell: null,
  chartPeriod: null,
  persistStatus: 'ok',
  updateReady: false,
  swStatus: 'registering',
  snackbar: null,
  refreshToday: () => {
    const today = todayStr();
    if (today !== get().today) set({ today });
  },
  renewDraftId: (id) => {
    const { draftIds } = get();
    if (draftIds.today === id) set({ draftIds: { ...draftIds, today: newId() } });
    else if (draftIds.undated === id) set({ draftIds: { ...draftIds, undated: newId() } });
  },
  renewAllDraftIds: () => set({ draftIds: { today: newId(), undated: newId() } }),
  setSelectedCell: (selectedCell) => set({ selectedCell }),
  setChartPeriod: (chartPeriod) => set({ chartPeriod }),
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
