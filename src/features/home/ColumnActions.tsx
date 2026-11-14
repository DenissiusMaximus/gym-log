import { useMemo, useState } from 'react';

import { useData } from '../../data/useData';
import { useUi } from '../../data/useUi';
import { formatColumnDate, formatLongDate } from '../../lib/date';
import * as haptics from '../../lib/haptics';
import { strings } from '../../lib/strings';
import { ActionSheet, type ActionSheetAction } from '../../ui/ActionSheet';
import { DatePickerDialog } from '../../ui/DatePickerDialog';
import { showSnackbar } from '../../ui/Snackbar';

type Props = {
  /** The workout whose menu is open; `null` closes the menu. */
  workoutId: string | null;
  onClose: () => void;
  /** Called with the workout that now holds the column (the target after a merge) so the table can scroll to it. */
  onReveal: (workoutId: string) => void;
  /** Extra distance above the bottom edge for snackbars (the FAB sits there). */
  snackbarOffset: number;
};

const s = strings.column;

/** Column menu (modal sheet) and the calendar that sets or changes the workout date. */
export function ColumnActions({ workoutId, onClose, onReveal, snackbarOffset }: Props) {
  // The workout and its date are captured when the menu opens: the menu and the calendar keep
  // showing them while they animate out, even after the workout was deleted or re-dated.
  const workouts = useData((st) => st.workouts);
  const [shown, setShown] = useState<{ id: string | null; date: string | null }>({ id: null, date: null });
  if (workoutId !== null) {
    const current = workouts[workoutId]?.date ?? null;
    if (workoutId !== shown.id || current !== shown.date) setShown({ id: workoutId, date: current });
  }
  const shownId = shown.id;
  const date = shown.date;
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = useUi((st) => st.today);

  const markedDates = useMemo(() => {
    const set = new Set<string>();
    for (const w of Object.values(workouts)) if (w.date !== null) set.add(w.date);
    return set;
  }, [workouts]);

  const applyDate = (nextDate: string) => {
    if (shownId === null) return;
    const result = useData.getState().setWorkoutDate(shownId, nextDate);
    haptics.confirm();
    if (result.merged) {
      showSnackbar({
        text: strings.data.merged(formatColumnDate(nextDate)),
        actionLabel: strings.common.undo,
        onAction: result.undo,
        bottomOffset: snackbarOffset,
      });
    }
    onReveal(result.targetId);
  };

  const remove = () => {
    if (shownId === null) return;
    const undo = useData.getState().deleteWorkout(shownId);
    haptics.reject();
    showSnackbar({
      text: s.deleted,
      actionLabel: strings.common.undo,
      onAction: undo,
      bottomOffset: snackbarOffset,
    });
  };

  const actions: ActionSheetAction[] =
    date === null
      ? [
          {
            key: 'today',
            label: s.todayItem(formatColumnDate(today)),
            icon: 'today',
            onPress: () => applyDate(today),
          },
          { key: 'pick', label: s.pickDate, icon: 'event_upcoming', onPress: () => setCalendarOpen(true) },
          { key: 'delete', label: s.delete, icon: 'delete', destructive: true, onPress: remove },
        ]
      : [
          { key: 'change', label: s.changeDate, icon: 'event_upcoming', onPress: () => setCalendarOpen(true) },
          { key: 'delete', label: s.delete, icon: 'delete', destructive: true, onPress: remove },
        ];

  return (
    <>
      <ActionSheet
        visible={workoutId !== null}
        onClose={onClose}
        title={date === null ? s.titleNoDate : s.title(formatLongDate(date))}
        actions={actions}
      />
      <DatePickerDialog
        visible={calendarOpen}
        value={date}
        today={today}
        markedDates={markedDates}
        // Another workout on the chosen date means the columns will be merged; the own date is not a conflict.
        getWarning={(picked) =>
          picked !== date && markedDates.has(picked) ? s.mergeWarning : null
        }
        onCancel={() => setCalendarOpen(false)}
        onConfirm={(picked) => {
          setCalendarOpen(false);
          applyDate(picked);
        }}
      />
    </>
  );
}
