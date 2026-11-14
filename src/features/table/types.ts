import type { Ref } from 'react';

export type CellRef = { workoutId: string; exerciseId: string };

/** Imperative API of the table (both platforms). */
export type WorkoutTableHandle = {
  /** Brings the workout column into view (centered when possible). */
  scrollToColumn: (workoutId: string, animated: boolean) => void;
  /** Scrolls the minimum needed to show the cell fully above `bottomInset` (height of a bottom panel). */
  ensureCellVisible: (workoutId: string, exerciseId: string, bottomInset: number) => void;
};

export type WorkoutTableProps = {
  /** Exercises, top to bottom. Must keep its identity while the content is unchanged. */
  rowIds: string[];
  /** Workouts, left to right (oldest first). Must keep its identity while the content is unchanged. */
  columnIds: string[];
  /** Local date `YYYY-MM-DD`; highlights the column of that date. */
  today: string;
  selectedCell: CellRef | null;
  /** Empty space below the last row (room for a FAB or a bottom panel). */
  bottomPad: number;
  onCellPress: (workoutId: string, exerciseId: string) => void;
  onHeaderPress: (workoutId: string) => void;
  onNamePress: (exerciseId: string) => void;
  onAddExercise: () => void;
  ref?: Ref<WorkoutTableHandle>;
};

/** What a column slot needs to know about one exercise row. */
export type RowInfo = { id: string; name: string };
