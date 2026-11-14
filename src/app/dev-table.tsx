import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { generateDemo } from '@/data/demo';
import { emptySnapshot } from '@/data/ops';
import { selectColumnIds, selectRowIds } from '@/data/selectors';
import { useData } from '@/data/useData';
import { useUi } from '@/data/useUi';
import { startFpsMeter, type FpsStats } from '@/dev/fps';
import { WorkoutTable } from '@/features/table/WorkoutTable';
import { getSlotCount, subscribeSlotCount } from '@/features/table/slotStats';
import type { CellRef, WorkoutTableHandle } from '@/features/table/types';
import { formatFullDate } from '@/lib/date';
import { formatWeight } from '@/lib/format';
import { strings } from '@/lib/strings';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/tokens';

const s = strings.devTable;
const NO_BOTTOM_PAD = 0;

type BtnProps = { title: string; onPress: () => void; tone?: 'tonal' | 'danger' };

function Btn({ title, onPress, tone = 'tonal' }: BtnProps) {
  const { colors } = useTheme();
  const bg = tone === 'danger' ? colors.errorContainer : colors.secondaryContainer;
  const fg = tone === 'danger' ? colors.onErrorContainer : colors.onSecondaryContainer;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

// Own component with own state: its 2 Hz refresh must not re-render the screen or the table.
function Overlay() {
  const { colors } = useTheme();
  const slots = useSyncExternalStore(subscribeSlotCount, getSlotCount, getSlotCount);
  const [fps, setFps] = useState<FpsStats>({ worst: 0, slow: 0, frames: 0 });

  useEffect(() => {
    const meter = startFpsMeter();
    const timer = setInterval(() => setFps(meter.read()), 500);
    return () => {
      clearInterval(timer);
      meter.stop();
    };
  }, []);

  return (
    <View
      pointerEvents="none"
      style={[styles.overlay, { backgroundColor: colors.inverseSurface }]}
    >
      <Text style={[styles.overlayText, { color: colors.inverseOnSurface }]}>{s.frames(fps.worst, fps.slow)}</Text>
      <Text style={[styles.overlayText, { color: colors.inverseOnSurface }]}>{s.slots(slots)}</Text>
    </View>
  );
}

// Temporary stage-2 screen: the table on demo data, to check smoothness and single-cell updates.
export default function DevTable() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = useUi((st) => st.today);
  const hydrated = useData((st) => st.hydrated);
  const rowIds = useData((st) => selectRowIds(st, 'all'));
  const columnIds = useData((st) => selectColumnIds(st, 'all', today));
  const tableRef = useRef<WorkoutTableHandle>(null);
  const [selected, setSelected] = useState<CellRef | null>(null);
  const [status, setStatus] = useState<string>(s.idle);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const generate = () => {
    useData.getState().importSnapshot(generateDemo(40, 300));
    setSelected(null);
  };

  const clearAll = () => {
    useData.getState().importSnapshot(emptySnapshot());
    setSelected(null);
  };

  const scrollFirst = () => {
    if (columnIds.length > 0) tableRef.current?.scrollToColumn(columnIds[0], true);
  };

  const scrollLast = () => {
    if (columnIds.length > 0) tableRef.current?.scrollToColumn(columnIds[columnIds.length - 1], true);
  };

  const onCellPress = useCallback((workoutId: string, exerciseId: string) => {
    const state = useData.getState();
    const entry = state.entries[workoutId]?.[exerciseId];
    const weights = entry ? entry.weights.map((w) => w + 1) : [1];
    state.setWeights(workoutId, exerciseId, weights);
    setSelected({ workoutId, exerciseId });
    const date = useData.getState().workouts[workoutId]?.date;
    setStatus(
      s.cellTapped(
        state.exercises[exerciseId]?.name ?? exerciseId,
        date ? formatFullDate(date) : strings.table.noDate,
        formatWeight(Math.max(...weights)),
      ),
    );
  }, []);

  const onHeaderPress = useCallback((workoutId: string) => {
    const date = useData.getState().workouts[workoutId]?.date;
    setStatus(s.headerTapped(date ? formatFullDate(date) : strings.table.noDate));
  }, []);

  const onNamePress = useCallback((exerciseId: string) => {
    setStatus(s.nameTapped(useData.getState().exercises[exerciseId]?.name ?? exerciseId));
  }, []);

  const onAddExercise = useCallback(() => setStatus(s.addTapped), []);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <View style={styles.titleRow}>
          <Btn title={s.back} onPress={back} />
          <Text style={[styles.title, { color: colors.onSurface }]}>{s.title}</Text>
          <Text style={[styles.size, { color: colors.onSurfaceVariant }]}>{s.size(rowIds.length, columnIds.length)}</Text>
        </View>
        <View style={styles.buttons}>
          <Btn title={strings.dev.generate} onPress={generate} />
          <Btn title={strings.dev.clearAll} tone="danger" onPress={clearAll} />
          <Btn title={s.scrollFirst} onPress={scrollFirst} />
          <Btn title={s.scrollLast} onPress={scrollLast} />
        </View>
        <Text style={[styles.status, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
          {status}
        </Text>
      </View>
      <View style={styles.tableBox}>
        {hydrated && (
          <WorkoutTable
            ref={tableRef}
            rowIds={rowIds}
            columnIds={columnIds}
            today={today}
            selectedCell={selected}
            bottomPad={insets.bottom + NO_BOTTOM_PAD}
            onCellPress={onCellPress}
            onHeaderPress={onHeaderPress}
            onNamePress={onNamePress}
            onAddExercise={onAddExercise}
          />
        )}
        <Overlay />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...typography.titleMedium, flex: 1 },
  size: { ...typography.labelMedium, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  buttonText: typography.labelLarge,
  status: { ...typography.bodySmall, minHeight: 16 },
  tableBox: { flex: 1 },
  overlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    opacity: 0.85,
    zIndex: 10,
  },
  overlayText: { ...typography.labelSmall, fontVariant: ['tabular-nums'] },
});
