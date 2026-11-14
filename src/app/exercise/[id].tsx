import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectSeries } from '@/data/selectors';
import { useData } from '@/data/useData';
import { useUi } from '@/data/useUi';
import { EmptyState } from '@/features/home/EmptyState';
import { CHART_HEIGHT } from '@/features/chart/chartLayout';
import { ChartSummary, StatCards } from '@/features/chart/ChartSummary';
import {
  defaultPeriod,
  filterPeriod,
  periodChange,
  PERIODS,
  plateau as plateauOf,
  record as recordOf,
  type ChartPeriod,
  type ChartPoint,
} from '@/features/chart/chartMath';
import { HistoryRow, HistoryTitle } from '@/features/chart/HistoryList';
import { ProgressChart } from '@/features/chart/ProgressChart';
import { ExerciseEditorDialog } from '@/features/manage/ExerciseEditorDialog';
import { strings } from '@/lib/strings';
import { useTheme } from '@/theme/ThemeProvider';
import { Chip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { SegmentedButtons } from '@/ui/SegmentedButtons';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const s = strings.chart;

/** With this many points or fewer the period is always "All" and its selector is hidden. */
const FEW_POINTS = 3;

const PERIOD_OPTIONS = PERIODS.map((value) => ({ value, label: s.periods[value] }));

const keyOf = (point: ChartPoint) => point.date;
const renderRow = ({ item }: { item: ChartPoint }) => <HistoryRow point={item} />;

export default function ExerciseChart() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = typeof id === 'string' ? id : '';

  const today = useUi((st) => st.today);
  const storedPeriod = useUi((st) => st.chartPeriod);
  const exercise = useData((st) => st.exercises[exerciseId]);
  // Subscribing to the two branches the series is built from; the series itself is a new array on
  // every call, so it must not be a selector result.
  const workouts = useData((st) => st.workouts);
  const entries = useData((st) => st.entries);

  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const series = useMemo(
    () => selectSeries(useData.getState(), exerciseId),
    // The series depends on exactly these two branches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workouts, entries, exerciseId],
  );
  const history = useMemo(() => [...series].reverse(), [series]);

  const few = series.length <= FEW_POINTS;
  const period: ChartPeriod = few ? 'All' : (storedPeriod ?? defaultPeriod(series, today));
  const view = useMemo(() => filterPeriod(series, period, today), [series, period, today]);
  const visible = useMemo(() => series.slice(view.from, view.to), [series, view]);

  const record = useMemo(() => recordOf(series), [series]);
  const plateau = useMemo(() => plateauOf(series), [series]);
  const change = useMemo(() => periodChange(visible), [visible]);

  // A point that no longer exists (an entry was deleted meanwhile) is simply not selected.
  const selected = pickedIndex !== null && pickedIndex < series.length ? pickedIndex : null;
  const summaryPoint = series[selected ?? series.length - 1];

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const choosePeriod = useCallback((next: ChartPeriod) => {
    useUi.getState().setChartPeriod(next);
    setPickedIndex(null);
  }, []);

  // A touch that starts outside the chart plane clears the selection. The screen sees the touch
  // first (capture phase), the plane then cancels the pending clear; it runs once both are done.
  const clearPending = useRef(false);
  const onOutsideTouch = useCallback(() => {
    clearPending.current = true;
    setTimeout(() => {
      if (!clearPending.current) return;
      clearPending.current = false;
      setPickedIndex(null);
    }, 0);
    return false;
  }, []);
  const onPlaneTouch = useCallback(() => {
    clearPending.current = false;
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 0;
    setScrolled((current) => (current === next ? current : next));
  }, []);

  const rootStyle = [styles.root, { backgroundColor: colors.surface }];

  if (!exercise) {
    return (
      <View style={rootStyle}>
        <TopAppBar title={s.screenTitle} onBack={goBack} />
        <EmptyState icon="show_chart" title={s.notFound} actionLabel={s.goToTable} onAction={goBack} />
      </View>
    );
  }

  const appBar = (
    <TopAppBar
      title={exercise.name}
      onBack={goBack}
      scrolled={scrolled}
      actions={<IconButton icon="edit" accessibilityLabel={s.editExercise} onPress={() => setEditorOpen(true)} />}
    />
  );
  const editor = (
    <ExerciseEditorDialog visible={editorOpen} onClose={() => setEditorOpen(false)} exerciseId={exerciseId} />
  );

  if (series.length === 0) {
    return (
      <View style={rootStyle}>
        {appBar}
        <EmptyState
          icon="show_chart"
          title={s.emptyTitle}
          body={s.emptyBody}
          actionLabel={s.goToTable}
          onAction={goBack}
        />
        {editor}
      </View>
    );
  }

  const header = (
    <View>
      <ChartSummary point={summaryPoint} scrubbing={selected !== null} today={today} />
      <StatCards
        record={record}
        change={change}
        plateau={plateau}
        showChange={series.length >= 2}
        fewPoints={few}
      />
      {!few ? (
        <View style={styles.period} testID="chart-period">
          <SegmentedButtons
            options={PERIOD_OPTIONS}
            value={period}
            onChange={choosePeriod}
            accessibilityLabel={s.period}
            showCheck={false}
          />
        </View>
      ) : null}
      {visible.length === 0 ? (
        <View style={styles.emptyPeriod} testID="chart-empty-period">
          <Text variant="bodyLarge" color="onSurfaceVariant">
            {s.noEntriesInPeriod}
          </Text>
          <Chip label={s.showAll} onPress={() => choosePeriod('All')} />
        </View>
      ) : (
        <ProgressChart
          series={series}
          view={view}
          period={period}
          selected={selected}
          onSelect={setPickedIndex}
          onPlaneTouch={onPlaneTouch}
        />
      )}
      {series.length === 1 ? (
        <Text variant="bodySmall" color="onSurfaceVariant" style={styles.caption} testID="chart-one-point">
          {s.lineAppears}
        </Text>
      ) : null}
      <HistoryTitle />
    </View>
  );

  return (
    <View style={rootStyle}>
      {appBar}
      <View style={styles.body} onStartShouldSetResponderCapture={onOutsideTouch}>
        <FlatList
          data={history}
          keyExtractor={keyOf}
          renderItem={renderRow}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          onScroll={onScroll}
          scrollEventThrottle={32}
          testID="chart-list"
        />
      </View>
      {editor}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  // A readable column on wide screens.
  content: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  period: { paddingHorizontal: 16, paddingBottom: 8 },
  emptyPeriod: { height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 12 },
  caption: { paddingHorizontal: 16, paddingBottom: 8 },
});
