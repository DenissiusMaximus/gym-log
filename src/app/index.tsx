import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectColumnIds, selectRowIds } from '@/data/selectors';
import { useData } from '@/data/useData';
import { useUi } from '@/data/useUi';
import { CellSheet } from '@/features/home/CellSheet';
import { ColumnActions } from '@/features/home/ColumnActions';
import { EmptyState } from '@/features/home/EmptyState';
import { FilterChips } from '@/features/home/FilterChips';
import { InstallHint } from '@/features/home/InstallHint';
import { ExerciseEditorDialog } from '@/features/manage/ExerciseEditorDialog';
import { HEADER_H, NAME_W } from '@/features/table/metrics';
import type { WorkoutTableHandle } from '@/features/table/types';
import { WorkoutTable } from '@/features/table/WorkoutTable';
import { formatColumnDate } from '@/lib/date';
import * as haptics from '@/lib/haptics';
import { strings } from '@/lib/strings';
import { useTheme } from '@/theme/ThemeProvider';
import { ActionSheet } from '@/ui/ActionSheet';
import { FabMenu } from '@/ui/FabMenu';
import { Text } from '@/ui/Text';

const s = strings.home;

/** Content bottom padding that clears the FAB: 88 dp plus the bottom safe area. */
const FAB_CLEARANCE = 88;
/** Snackbars sit this far above the bottom edge so they clear the FAB. */
const FAB_SNACKBAR_OFFSET = 72;
const FILTER_FADE_MS = 150;

type EditorState = { open: boolean; exerciseId: string | null };
/** `workoutId: null` scrolls to the newest column (the right edge). */
type ScrollRequest = { workoutId: string | null; animated: boolean };

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const tableRef = useRef<WorkoutTableHandle>(null);

  const today = useUi((st) => st.today);
  const selectedCell = useUi((st) => st.selectedCell);
  const groups = useData((st) => st.groups);
  const savedFilter = useData((st) => st.meta.activeFilter);

  const groupList = useMemo(
    () => Object.values(groups).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)),
    [groups],
  );
  // A saved group that no longer exists falls back to "All".
  const filter = savedFilter === 'all' || groups[savedFilter] ? savedFilter : 'all';
  useEffect(() => {
    if (filter !== savedFilter) useData.getState().setMeta({ activeFilter: filter });
  }, [filter, savedFilter]);

  const rowIds = useData((st) => selectRowIds(st, filter));
  const allRowIds = useData((st) => selectRowIds(st, 'all'));
  const columnIds = useData((st) => selectColumnIds(st, filter, today));
  const todayWorkoutId = useData((st) => {
    for (const workout of Object.values(st.workouts)) if (workout.date === today) return workout.id;
    return null;
  });
  // The panel edits a cell only while both its workout and its (active) exercise exist.
  const cellExists = useData(
    (st) =>
      selectedCell !== null &&
      st.workouts[selectedCell.workoutId] !== undefined &&
      st.exercises[selectedCell.exerciseId]?.archivedAt === null,
  );
  const panelCell = cellExists ? selectedCell : null;

  const [sheetHeight, setSheetHeight] = useState(0);
  const [menuWorkoutId, setMenuWorkoutId] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ open: false, exerciseId: null });
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);

  const hasExercises = allRowIds.length > 0;
  const panelOpen = panelCell !== null;
  const bottomPad = sheetHeight > 0 ? sheetHeight : FAB_CLEARANCE + insets.bottom;

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

  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const closePanel = useCallback(() => useUi.getState().setSelectedCell(null), []);

  const onSelectFilter = useCallback(
    (next: string) => {
      if (next === useData.getState().meta.activeFilter) return;
      closePanel();
      fade.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: FILTER_FADE_MS })));
      useData.getState().setMeta({ activeFilter: next });
      setScrollRequest({ workoutId: null, animated: false });
    },
    [closePanel, fade],
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

  // The exercise chart arrives in a later stage; until then the name opens the editor.
  const onNamePress = useCallback(
    (exerciseId: string) => {
      closePanel();
      setEditor({ open: true, exerciseId });
    },
    [closePanel],
  );

  const onAddExercise = useCallback(() => {
    closePanel();
    setEditor({ open: true, exerciseId: null });
  }, [closePanel]);

  const closeEditor = useCallback(() => setEditor((current) => ({ ...current, open: false })), []);
  const closeMenu = useCallback(() => setMenuWorkoutId(null), []);
  const revealWorkout = useCallback((workoutId: string) => setScrollRequest({ workoutId, animated: true }), []);

  // The group is passed along, so the manage screen opens with it already selected.
  const openManageForGroup = () => {
    closePanel();
    router.push({ pathname: '/manage', params: { group: filter } });
  };

  const openMore = () => {
    closePanel();
    setMoreOpen(true);
  };

  const createWorkout = (date: string | null) => {
    const id = useData.getState().addWorkout(date);
    haptics.confirm();
    revealWorkout(id);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <FilterChips groups={groupList} filter={filter} onSelect={onSelectFilter} onMore={openMore} />
      <InstallHint />

      <Animated.View style={[styles.body, fadeStyle]}>
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
          <>
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
            {columnIds.length === 0 ? (
              <View style={styles.hint}>
                <Text variant="bodyMedium" color="onSurfaceVariant" style={styles.hintText}>
                  {s.noWorkouts}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </Animated.View>

      <FabMenu
        open={fabOpen}
        onOpenChange={setFabOpen}
        accessibilityLabel={s.newWorkout}
        visible={hasExercises && !panelOpen}
        items={[
          {
            key: 'today',
            label: todayWorkoutId ? s.goToToday : s.today(formatColumnDate(today)),
            icon: 'today',
            onPress: () => (todayWorkoutId ? revealWorkout(todayWorkoutId) : createWorkout(today)),
          },
          { key: 'nodate', label: s.noDate, icon: 'event_upcoming', onPress: () => createWorkout(null) },
        ]}
      />

      <CellSheet cell={panelCell} onClose={closePanel} onHeightChange={setSheetHeight} />

      <ColumnActions
        workoutId={menuWorkoutId}
        onClose={closeMenu}
        onReveal={revealWorkout}
        snackbarOffset={FAB_SNACKBAR_OFFSET}
      />

      <ExerciseEditorDialog
        visible={editor.open}
        onClose={closeEditor}
        exerciseId={editor.exerciseId}
        defaultGroupId={filter === 'all' ? null : filter}
        snackbarOffset={FAB_SNACKBAR_OFFSET}
      />

      <ActionSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        actions={[
          { key: 'manage', label: s.manage, icon: 'fitness_center', onPress: () => router.push('/manage') },
          { key: 'dev', label: s.developerPanel, icon: 'settings', onPress: () => router.push('/dev') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  // Right of the name column, below the header: where the missing dates would be.
  hint: {
    position: 'absolute',
    top: HEADER_H,
    left: NAME_W,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    pointerEvents: 'none',
  },
  hintText: { textAlign: 'center' },
});
