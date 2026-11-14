import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatLongDate, formatMonthTitle, parseDate, todayStr, WEEKDAYS_SHORT } from '../lib/date';
import { strings } from '../lib/strings';
import { useTheme } from '../theme/ThemeProvider';
import { shape } from '../theme/tokens';
import { Button } from './Button';
import { buildMonthGrid, shiftMonth, type GridCell } from './calendarGrid';
import { Dialog } from './Dialog';
import { IconButton } from './IconButton';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';
import { createThemedStyles, useFills } from './themed';

type Props = {
  visible: boolean;
  /** Date shown as selected when the dialog opens (`YYYY-MM-DD`); `null` starts on today's month with nothing selected. */
  value: string | null;
  onCancel: () => void;
  onConfirm: (date: string) => void;
  /** Dates that get a 4 dp dot under the number (for example days that already have a workout). */
  markedDates?: ReadonlySet<string>;
  /** Today as `YYYY-MM-DD`; defaults to the device date. Pass the app's `today` so both agree. */
  today?: string;
  /** Text under the grid for the currently selected date (null for none). */
  getWarning?: (date: string) => string | null;
};

const CELL = 40;

const useRing = createThemedStyles((c) => StyleSheet.create({ today: { borderWidth: 1, borderColor: c.primary } }));

type DayProps = {
  cell: GridCell;
  selected: boolean;
  isToday: boolean;
  marked: boolean;
  onSelect: (date: string) => void;
};

const Day = memo(function Day({ cell, selected, isToday, marked, onSelect }: DayProps) {
  const { colors } = useTheme();
  const fills = useFills();
  const ring = useRing();

  if (!cell.inMonth) return <View style={styles.slot} />;

  return (
    <View style={styles.slot}>
      <PressableSurface
        onPress={() => onSelect(cell.date)}
        radius={CELL / 2}
        layerColor={selected ? colors.onPrimary : colors.onSurface}
        style={[styles.day, selected ? fills.primary : isToday ? ring.today : null]}
        accessibilityLabel={formatLongDate(cell.date)}
        accessibilityState={{ selected }}
      >
        <Text variant="bodyMedium" color={selected ? 'onPrimary' : isToday ? 'primary' : 'onSurface'} numeric>
          {cell.day}
        </Text>
        {marked ? <View style={[styles.dot, selected ? fills.onPrimary : fills.primary]} /> : null}
      </PressableSurface>
    </View>
  );
});

type MonthView = { year: number; month: number };

type CalendarProps = {
  view: MonthView;
  onViewChange: (view: MonthView) => void;
  draft: string | null;
  onDraftChange: (date: string) => void;
  today: string;
  markedDates?: ReadonlySet<string>;
  warning: string | null;
};

function Calendar({ view, onViewChange, draft, onDraftChange, today, markedDates, warning }: CalendarProps) {
  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view.year, view.month]);
  const weeks = useMemo(() => Array.from({ length: 6 }, (_, w) => grid.slice(w * 7, w * 7 + 7)), [grid]);
  const move = (delta: number) => onViewChange(shiftMonth(view.year, view.month, delta));

  return (
    <View>
      <Text variant="labelMedium" color="onSurfaceVariant" style={styles.caption}>
        {strings.ui.selectDate}
      </Text>
      <View style={styles.header}>
        <Text
          variant="titleMedium"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={styles.month}
          numeric
        >
          {formatMonthTitle(view.year, view.month)}
        </Text>
        <IconButton icon="chevron_left" accessibilityLabel={strings.ui.previousMonth} onPress={() => move(-1)} />
        <IconButton icon="chevron_right" accessibilityLabel={strings.ui.nextMonth} onPress={() => move(1)} />
      </View>
      <View style={styles.weekdays}>
        {WEEKDAYS_SHORT.map((name) => (
          <View key={name} style={styles.slot}>
            <Text variant="labelMedium" color="onSurfaceVariant" accessibilityLabel={name}>
              {name.slice(0, 1)}
            </Text>
          </View>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0].date} style={styles.week}>
          {week.map((cell) => (
            <Day
              key={cell.date}
              cell={cell}
              selected={cell.date === draft}
              isToday={cell.date === today}
              marked={markedDates?.has(cell.date) ?? false}
              onSelect={onDraftChange}
            />
          ))}
        </View>
      ))}
      {warning ? (
        <Text variant="bodyMedium" color="tertiary" accessibilityLiveRegion="polite" style={styles.warning}>
          {warning}
        </Text>
      ) : null}
    </View>
  );
}

function monthOf(date: string): MonthView {
  const parts = parseDate(date) ?? parseDate(todayStr())!;
  return { year: parts.year, month: parts.month };
}

/**
 * Dialog with a month grid (7 x 6 circles of 40 dp, week from Monday) for picking one
 * `YYYY-MM-DD` date. Every opening starts from `value`; "Done" confirms the selected date.
 */
export function DatePickerDialog({ visible, value, onCancel, onConfirm, markedDates, today, getWarning }: Props) {
  const todayDate = today ?? todayStr();
  const [draft, setDraft] = useState<string | null>(value);
  const [view, setView] = useState<MonthView>(() => monthOf(value ?? todayDate));
  const [wasVisible, setWasVisible] = useState(visible);

  // Reset the draft each time the dialog opens (derived during render, no extra frame).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
      setView(monthOf(value ?? todayDate));
    }
  }

  const warning = draft && getWarning ? getWarning(draft) : null;

  return (
    <Dialog
      visible={visible}
      onClose={onCancel}
      margin={16}
      padding={16}
      accessibilityLabel={strings.ui.selectDate}
      actions={
        <>
          <Button title={strings.ui.cancel} variant="text" onPress={onCancel} />
          <Button
            title={strings.ui.done}
            variant="text"
            disabled={draft === null}
            onPress={() => {
              if (draft !== null) onConfirm(draft);
            }}
          />
        </>
      }
    >
      <Calendar
        view={view}
        onViewChange={setView}
        draft={draft}
        onDraftChange={setDraft}
        today={todayDate}
        markedDates={markedDates}
        warning={warning}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { paddingLeft: 8, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  month: { flex: 1 },
  weekdays: { flexDirection: 'row', height: 32 },
  week: { flexDirection: 'row', height: 48 },
  day: { width: CELL, height: CELL, borderRadius: shape.full },
  dot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2 },
  warning: { marginTop: 8, paddingHorizontal: 8 },
});
