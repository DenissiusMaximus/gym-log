import { useMemo, useState } from 'react';

import { useData } from '../../data/useData';
import { useUi } from '../../data/useUi';
import { columnDate } from '../../data/virtualColumns';
import { formatColumnDate, formatLongDate } from '../../lib/date';
import * as haptics from '../../lib/haptics';
import { strings } from '../../lib/strings';
import { ActionSheet, type ActionSheetAction } from '../../ui/ActionSheet';
import { DatePickerDialog } from '../../ui/DatePickerDialog';
import { showSnackbar } from '../../ui/Snackbar';

type Props = {
  /** The column whose menu is open (a workout or a virtual column); `null` closes the menu. */
  workoutId: string | null;
  onClose: () => void;
  /** Called with the column to scroll to (the target after a merge, or a virtual column). */
  onReveal: (workoutId: string) => void;
  /** Extra distance above the bottom edge for snackbars. */
  snackbarOffset: number;
};

type Kind = 'virtualToday' | 'virtualUndated' | 'real';
type Shown = { id: string | null; date: string | null; kind: Kind };
/** 'redate' sets the date of the shown workout; 'create' opens a column for another date. */
type CalendarMode = 'redate' | 'create';

const s = strings.column;

/** Column menu (modal sheet) and the calendar that sets the date or opens a column for another date. */
export function ColumnActions({ workoutId, onClose, onReveal, snackbarOffset }: Props) {
  // The column, its date and kind are captured when the menu opens: the menu and the calendar keep
  // showing them while they animate out, even after the workout was deleted or re-dated.
  const workouts = useData((st) => st.workouts);
  const draftIds = useUi((st) => st.draftIds);
  const today = useUi((st) => st.today);
  const [shown, setShown] = useState<Shown>({ id: null, date: null, kind: 'real' });
  if (workoutId !== null) {
    const current = columnDate(workouts, draftIds, today, workoutId);
    const kind: Kind = workouts[workoutId] ? 'real' : workoutId === draftIds.today ? 'virtualToday' : 'virtualUndated';
    if (workoutId !== shown.id || current !== shown.date || kind !== shown.kind) {
      setShown({ id: workoutId, date: current, kind });
    }
  }
  const { id: shownId, date, kind } = shown;
  const [calendar, setCalendar] = useState<CalendarMode | null>(null);

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

  // A new column for today is the virtual one (it becomes a workout with the first weight).
  const createColumn = (picked: string) => {
    const hasToday = Object.values(useData.getState().workouts).some((w) => w.date === picked);
    if (picked === today && !hasToday) {
      onReveal(draftIds.today);
      return;
    }
    const id = useData.getState().addWorkout(picked);
    haptics.confirm();
    onReveal(id);
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

  const another: ActionSheetAction = {
    key: 'another',
    label: s.another,
    icon: 'event_upcoming',
    onPress: () => setCalendar('create'),
  };
  const deleteAction: ActionSheetAction = {
    key: 'delete',
    label: s.delete,
    icon: 'delete',
    destructive: true,
    onPress: remove,
  };

  let actions: ActionSheetAction[];
  if (kind === 'virtualUndated') {
    actions = [{ key: 'pick', label: s.pickDate, icon: 'event_upcoming', onPress: () => setCalendar('create') }];
  } else if (kind === 'virtualToday') {
    actions = [another];
  } else if (date === null) {
    actions = [
      { key: 'today', label: s.todayItem(formatColumnDate(today)), icon: 'today', onPress: () => applyDate(today) },
      { key: 'pick', label: s.pickDate, icon: 'event_upcoming', onPress: () => setCalendar('redate') },
      another,
      deleteAction,
    ];
  } else {
    actions = [
      { key: 'change', label: s.changeDate, icon: 'event_upcoming', onPress: () => setCalendar('redate') },
      another,
      deleteAction,
    ];
  }

  return (
    <>
      <ActionSheet
        visible={workoutId !== null}
        onClose={onClose}
        title={date === null ? s.titleNoDate : s.title(formatLongDate(date))}
        actions={actions}
      />
      <DatePickerDialog
        visible={calendar !== null}
        value={calendar === 'redate' ? date : null}
        today={today}
        markedDates={markedDates}
        // 'redate': another workout on the chosen date means the columns will be merged (the own date
        // is not a conflict). 'create': a taken date means the table scrolls to that workout.
        getWarning={(picked) => {
          if (calendar === 'create') return markedDates.has(picked) ? s.existsNote : null;
          return picked !== date && markedDates.has(picked) ? s.mergeWarning : null;
        }}
        onCancel={() => setCalendar(null)}
        onConfirm={(picked) => {
          const mode = calendar;
          setCalendar(null);
          if (mode === 'redate') applyDate(picked);
          else if (mode === 'create') createColumn(picked);
        }}
      />
    </>
  );
}
