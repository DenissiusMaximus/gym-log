import { useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectColumnIds, selectRowIds } from '@/data/selectors';
import { useData } from '@/data/useData';
import { useUi } from '@/data/useUi';
import { activeDraftDate } from '@/data/virtualColumns';
import { CellSheet } from '@/features/home/CellSheet';
import { ColumnActions } from '@/features/home/ColumnActions';
import { EmptyState } from '@/features/home/EmptyState';
import { FilterChips } from '@/features/home/FilterChips';
import { InstallHint } from '@/features/home/InstallHint';
import { ExerciseEditorDialog } from '@/features/manage/ExerciseEditorDialog';
import type { WorkoutTableHandle } from '@/features/table/types';
import { WorkoutTable } from '@/features/table/WorkoutTable';
import * as haptics from '@/lib/haptics';
import { strings } from '@/lib/strings';
import { useTheme } from '@/theme/ThemeProvider';
import { ActionSheet } from '@/ui/ActionSheet';

const s = strings.home;

/** Content bottom padding below the last row (plus the bottom safe area) while the panel is closed. */
const BOTTOM_GAP = 16;
const FILTER_FADE_MS = 150;
const FILTER_ENTERING = FadeIn.duration(FILTER_FADE_MS);

type EditorState = { open: boolean; exerciseId: string | null };
/** `workoutId: null` scrolls to the newest column (the right edge). */
type ScrollRequest = { workoutId: string | null; animated: boolean };

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const tableRef = useRef<WorkoutTableHandle>(null);

  const today = useUi((st) => st.today);
  const draftIds = useUi((st) => st.draftIds);
  const selectedCell = useUi((st) => st.selectedCell);
  const groups = useData((st) => st.groups);
  const savedFilter = useData((st) => st.meta.activeFilter);

  const groupList = useMemo(
    () => Object.values(groups).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)),
    [groups],
  );
  // A saved group that no longer exists falls back to "All".
  const filter = savedFilter === 'all' || groups[savedFilter] ? savedFilter : 'all';
  const deferredFilter = useDeferredValue(filter);
  // Native: the chip updates at once, the table re-renders in the background and fades in when mounted.
  const tableFilter = Platform.OS === 'web' ? filter : deferredFilter;
  useEffect(() => {
    if (filter !== savedFilter) useData.getState().setMeta({ activeFilter: filter });
  }, [filter, savedFilter]);

  const rowIds = useData((st) => selectRowIds(st, tableFilter));
  const allRowIds = useData((st) => selectRowIds(st, 'all'));
  const columnIds = useData((st) => selectColumnIds(st, tableFilter, today, draftIds));
  // The panel edits a cell only while its column (a workout or an active virtual column) and its
  // (active) exercise exist.
  const cellExists = useData(
    (st) =>
      selectedCell !== null &&
      (st.workouts[selectedCell.workoutId] !== undefined ||
        activeDraftDate(st.workouts, draftIds, today, selectedCell.workoutId) !== undefined) &&
      st.exercises[selectedCell.exerciseId]?.archivedAt === null,
  );
  const panelCell = cellExists ? selectedCell : null;

  const [sheetHeight, setSheetHeight] = useState(0);
  const [menuWorkoutId, setMenuWorkoutId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ open: false, exerciseId: null });
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);

  const hasExercises = allRowIds.length > 0;
  const bottomPad = sheetHeight > 0 ? sheetHeight : BOTTOM_GAP + insets.bottom;

  // Scrolling runs in an effect so the table already holds the new columns when it moves.
  const columnIdsRef = useRef(columnIds);
  useEffect(() => {
    columnIdsRef.current = columnIds;
  });
  useEffect(() => {
    if (!scrollRequest) return;
    const columns = columnIdsRef.current;
    const id = scrollRequest.workoutId ?? columns[columns.length - 1];
    if (id !== undefined) tableRef.current?.scrollToColumn(id, scrollRequest.animated);
  }, [scrollRequest]);

  // Keep the selected cell visible above the panel when it opens, retargets or changes height.
  const selectedWorkoutId = panelCell?.workoutId ?? null;
  const selectedExerciseId = panelCell?.exerciseId ?? null;
  useEffect(() => {
    if (selectedWorkoutId !== null && selectedExerciseId !== null && sheetHeight > 0) {
      tableRef.current?.ensureCellVisible(selectedWorkoutId, selectedExerciseId, sheetHeight);
    }
  }, [selectedWorkoutId, selectedExerciseId, sheetHeight]);

  const reduced = useReducedMotion();
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const closePanel = useCallback(() => useUi.getState().setSelectedCell(null), []);

  const onSelectFilter = useCallback(
    (next: string) => {
      if (next === useData.getState().meta.activeFilter) return;
      closePanel();
      if (Platform.OS === 'web') {
        // Reduced motion: the table content swaps without the fade-in.
        if (!reduced) fade.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: FILTER_FADE_MS })));
        useData.getState().setMeta({ activeFilter: next });
        setScrollRequest({ workoutId: null, animated: false });
        return;
      }
      // On native the fade is the `entering` of the remounted (`key`) table, which already sits at the newest
      // dates; an opacity drop here would start before the new table and `scrollRequest` would scroll the old one.
      useData.getState().setMeta({ activeFilter: next });
    },
    [closePanel, fade, reduced],
  );

  const onCellPress = useCallback((workoutId: string, exerciseId: string) => {
    haptics.tapCell();
    const ui = useUi.getState();
    if (ui.selectedCell?.workoutId === workoutId && ui.selectedCell.exerciseId === exerciseId) return;
    ui.setSelectedCell({ workoutId, exerciseId });
  }, []);

  const onHeaderPress = useCallback(
    (workoutId: string) => {
      closePanel();
      setMenuWorkoutId(workoutId);
    },
    [closePanel],
  );

  // The name opens the exercise chart; the chart screen has the edit button.
  const onNamePress = useCallback(
    (exerciseId: string) => {
      closePanel();
      router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } });
    },
    [closePanel, router],
  );

  const onAddExercise = useCallback(() => {
    closePanel();
    setEditor({ open: true, exerciseId: null });
  }, [closePanel]);

  const closeEditor = useCallback(() => setEditor((current) => ({ ...current, open: false })), []);
  const closeMenu = useCallback(() => setMenuWorkoutId(null), []);
  const revealWorkout = useCallback((workoutId: string) => setScrollRequest({ workoutId, animated: !reduced }), [reduced]);

  // The group is passed along, so the manage screen opens with it already selected.
  const openManageForGroup = () => {
    closePanel();
    router.push({ pathname: '/manage', params: { group: tableFilter } });
  };

  const openMore = () => {
    closePanel();
    setMoreOpen(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <FilterChips groups={groupList} filter={filter} onSelect={onSelectFilter} onMore={openMore} />
      <InstallHint />

      <Animated.View style={[styles.body, fadeStyle]}>
        {/* Native: a new filter mounts the table via the cold-start path (`contentOffset` and the column window
            right at the newest dates) and fades it in from mount; `skipEntering` skips the fade on first open. */}
        <LayoutAnimationConfig skipEntering>
          <Animated.View
            key={Platform.OS === 'web' ? undefined : tableFilter}
            entering={Platform.OS === 'web' || reduced ? undefined : FILTER_ENTERING}
            style={styles.body}
          >
            {!hasExercises ? (
              <EmptyState
                icon="fitness_center"
                title={s.emptyTitle}
                body={s.emptyBody}
                actionLabel={s.addExercise}
                onAction={onAddExercise}
              />
            ) : rowIds.length === 0 ? (
              // A group without exercises: the table would only show dates.
              <EmptyState title={s.emptyGroup} actionLabel={s.addExercises} onAction={openManageForGroup} />
            ) : (
              <WorkoutTable
                ref={tableRef}
                rowIds={rowIds}
                columnIds={columnIds}
                today={today}
                selectedCell={panelCell}
                bottomPad={bottomPad}
                onCellPress={onCellPress}
                onHeaderPress={onHeaderPress}
                onNamePress={onNamePress}
                onAddExercise={onAddExercise}
              />
            )}
          </Animated.View>
        </LayoutAnimationConfig>
      </Animated.View>

      <CellSheet cell={panelCell} onClose={closePanel} onHeightChange={setSheetHeight} />

      <ColumnActions
        workoutId={menuWorkoutId}
        onClose={closeMenu}
        onReveal={revealWorkout}
        snackbarOffset={0}
      />

      <ExerciseEditorDialog
        visible={editor.open}
        onClose={closeEditor}
        exerciseId={editor.exerciseId}
        defaultGroupId={filter === 'all' ? null : filter}
        snackbarOffset={0}
      />

      <ActionSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        actions={[
          { key: 'manage', label: s.manage, icon: 'fitness_center', onPress: () => router.push('/manage') },
          { key: 'settings', label: s.settings, icon: 'settings', onPress: () => router.push('/settings') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});
