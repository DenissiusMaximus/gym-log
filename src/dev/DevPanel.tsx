import { useRouter } from 'expo-router';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BUILD_TIME } from '../buildInfo.generated';
import { BackupError, backupFileName, describeSummary, parseAndValidate, serialize, type ParsedBackup } from '../data/backup';
import { exportBackupFile, pickBackupFile } from '../data/backupIO';
import { generateDemo } from '../data/demo';
import { emptySnapshot } from '../data/ops';
import { toSnapshot } from '../data/store';
import { persist, useData } from '../data/useData';
import { useUi } from '../data/useUi';
import { resetAppCache, applyUpdate } from '../pwa/registerSW';
import { strings } from '../lib/strings';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/tokens';
import { clearErrorLog, getErrorLog, logError, subscribeErrorLog } from './errorLog';
import { startFpsMeter, type FpsStats } from './fps';

const s = strings.dev;
const isWeb = Platform.OS === 'web';

type Probe = { persisted: string; standalone: string; controlled: string };

function readProbe(): Probe {
  if (!isWeb) return { persisted: s.unknown, standalone: s.unknown, controlled: s.unknown };
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return {
    persisted: '...',
    standalone: standalone === undefined ? s.unknown : String(standalone),
    controlled: 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? s.yes : s.no) : s.unknown,
  };
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.onSurface }]} selectable>
        {value}
      </Text>
    </View>
  );
}

type BtnProps = { title: string; onPress: () => void; tone?: 'tonal' | 'filled' | 'danger'; disabled?: boolean };

function Btn({ title, onPress, tone = 'tonal', disabled }: BtnProps) {
  const { colors } = useTheme();
  const bg = tone === 'filled' ? colors.primary : tone === 'danger' ? colors.errorContainer : colors.secondaryContainer;
  const fg =
    tone === 'filled' ? colors.onPrimary : tone === 'danger' ? colors.onErrorContainer : colors.onSecondaryContainer;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceContainerLow }]}>
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</Text>
      {children}
    </View>
  );
}

export function DevPanel() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useData();
  const ui = useUi();
  const errors = useSyncExternalStore(subscribeErrorLog, getErrorLog, getErrorLog);
  const [probe, setProbe] = useState<Probe>(readProbe);
  const [fps, setFps] = useState<FpsStats>({ worst: 0, slow: 0, frames: 0 });
  const [simulating, setSimulating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ParsedBackup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isWeb && navigator.storage?.persisted) {
      navigator.storage.persisted().then(
        (value) => setProbe((p) => ({ ...p, persisted: String(value) })),
        () => setProbe((p) => ({ ...p, persisted: s.unknown })),
      );
    }
  }, []);

  useEffect(() => {
    const meter = startFpsMeter();
    const timer = setInterval(() => setFps(meter.read()), 500);
    return () => {
      clearInterval(timer);
      meter.stop();
    };
  }, []);

  const run = (name: string, task: () => Promise<void> | void) => {
    setBusy(name);
    Promise.resolve()
      .then(task)
      .catch((error) => {
        logError(name, error);
        setNotice(error instanceof BackupError ? error.message : String(error));
      })
      .finally(() => setBusy(null));
  };

  const exportNow = () => {
    // The backup text and share call run synchronously inside the tap handler (Safari needs that).
    const promise = exportBackupFile(serialize(toSnapshot(useData.getState())), backupFileName(ui.today));
    run('export', async () => {
      if (await promise) useData.getState().setMeta({ lastBackupAt: new Date().toISOString() });
    });
  };

  const importNow = () => {
    const promise = pickBackupFile();
    run('import', async () => {
      const text = await promise;
      if (text !== null) setPendingImport(parseAndValidate(text));
    });
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    const undo = useData.getState().importSnapshot(pendingImport.snapshot);
    setPendingImport(null);
    ui.showSnackbar({ text: strings.data.replaced, actionLabel: strings.common.undo, onAction: undo, duration: 10_000 });
  };

  const addEntry = () => {
    const state = useData.getState();
    let exerciseId = Object.keys(state.exercises)[0];
    if (!exerciseId) exerciseId = state.addExercise('Exercise 1', []);
    const workout = Object.values(useData.getState().workouts).find((w) => w.date === ui.today);
    const workoutId = workout ? workout.id : useData.getState().addWorkout(ui.today);
    const current = useData.getState().entries[workoutId]?.[exerciseId]?.weights[0] ?? 0;
    useData.getState().setWeights(workoutId, exerciseId, [current + 1]);
  };

  const generate = () => {
    const undo = useData.getState().importSnapshot(generateDemo(40, 300));
    ui.showSnackbar({ text: strings.data.replaced, actionLabel: strings.common.undo, onAction: undo, duration: 10_000 });
  };

  const clearAll = () => {
    const undo = useData.getState().importSnapshot(emptySnapshot());
    ui.showSnackbar({ text: strings.data.replaced, actionLabel: strings.common.undo, onAction: undo, duration: 10_000 });
  };

  const toggleFailure = () => {
    const next = !simulating;
    persist.simulateFailure(next);
    setSimulating(next);
    if (!next) {
      // Writes resume with the next change; flush now so the banner clears.
      void persist.replaceAll(toSnapshot(useData.getState()));
    }
  };

  const counts = [
    ['exercises', Object.keys(data.exercises).length],
    ['groups', Object.keys(data.groups).length],
    [
      'memberships',
      Object.values(data.memberships).reduce((n, m) => n + Object.keys(m).length, 0),
    ],
    ['workouts', Object.keys(data.workouts).length],
    ['entries', Object.values(data.entries).reduce((n, e) => n + Object.keys(e).length, 0)],
  ] as const;

  const swLabel = ui.swStatus + (probe.controlled !== s.unknown ? `, ${s.controlled}: ${probe.controlled}` : '');
  const text = { color: colors.onSurface };
  const muted = { color: colors.onSurfaceVariant };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]}
      >
        <Text style={[styles.title, text]}>{s.title}</Text>

        {ui.updateReady && (
          <View style={[styles.banner, { backgroundColor: colors.primaryContainer }]}>
            <Text style={[styles.bannerText, { color: colors.onPrimaryContainer }]}>{strings.update.available}</Text>
            <Btn title={strings.update.action} tone="filled" onPress={() => run('update', applyUpdate)} />
          </View>
        )}

        {ui.persistStatus === 'failed' && (
          <View style={[styles.banner, { backgroundColor: colors.errorContainer }]}>
            <Text style={[styles.bannerText, { color: colors.onErrorContainer }]}>{strings.persist.failedBanner}</Text>
            <Btn title={strings.persist.saveCopy} onPress={exportNow} />
          </View>
        )}

        {pendingImport && (
          <View style={[styles.banner, { backgroundColor: colors.tertiaryContainer }]}>
            <Text style={[styles.bannerText, { color: colors.onTertiaryContainer }]}>
              {describeSummary(pendingImport.summary)}
            </Text>
            <Btn title={strings.backup.replace} tone="filled" onPress={confirmImport} />
            <Btn title={strings.common.cancel} onPress={() => setPendingImport(null)} />
          </View>
        )}

        {notice && (
          <View style={[styles.banner, { backgroundColor: colors.errorContainer }]}>
            <Text style={[styles.bannerText, { color: colors.onErrorContainer }]}>{notice}</Text>
            <Btn title="OK" onPress={() => setNotice(null)} />
          </View>
        )}

        <Section title={s.storage}>
          <Row label={s.rev} value={String(data.meta.rev)} />
          <Row label={s.persistStatus} value={ui.persistStatus} />
          <Row label={s.storagePersisted} value={probe.persisted} />
          <Row label={s.standalone} value={probe.standalone} />
          <Row label={s.serviceWorker} value={swLabel} />
          <Row label={s.build} value={BUILD_TIME} />
          <Row label={s.fps} value={`worst ${fps.worst.toFixed(0)} ms, >24 ms: ${fps.slow}, frames: ${fps.frames}`} />
        </Section>

        <Section title={s.rows}>
          {counts.map(([name, n]) => (
            <Row key={name} label={name} value={String(n)} />
          ))}
        </Section>

        <Section title={s.actions}>
          <View style={styles.buttons}>
            <Btn title={s.addEntry} onPress={addEntry} disabled={!data.hydrated} />
            <Btn title={s.generate} onPress={generate} disabled={!data.hydrated} />
            <Btn title={s.clearAll} tone="danger" onPress={clearAll} disabled={!data.hydrated} />
            <Btn title={s.openTable} onPress={() => router.push('/dev-table')} />
            <Btn title={s.export} onPress={exportNow} disabled={busy === 'export'} />
            <Btn title={s.import} onPress={importNow} disabled={busy === 'import'} />
            <Btn title={simulating ? s.stopSimulatingFailure : s.simulateFailure} onPress={toggleFailure} />
            <Btn
              title={s.resetCache}
              onPress={() =>
                run('reset-cache', async () => {
                  await resetAppCache();
                  if (isWeb) location.reload();
                })
              }
            />
          </View>
        </Section>

        <Section title={`${s.errors} (${errors.length})`}>
          {errors.length === 0 ? (
            <Text style={[styles.value, muted]}>{s.noErrors}</Text>
          ) : (
            <>
              {[...errors].reverse().map((e, i) => (
                <Text key={i} style={[styles.logLine, text]} selectable>
                  {e.time.slice(11, 19)} [{e.source}] {e.message}
                </Text>
              ))}
              <Btn title={s.clearLog} onPress={clearErrorLog} />
            </>
          )}
        </Section>
      </ScrollView>

      {ui.snackbar && (
        <View style={[styles.snackbar, { backgroundColor: colors.inverseSurface, bottom: insets.bottom + 16 }]}>
          <Text style={[styles.snackbarText, { color: colors.inverseOnSurface }]}>{ui.snackbar.text}</Text>
          {ui.snackbar.actionLabel && (
            <Pressable
              accessibilityRole="button"
              style={styles.snackbarAction}
              onPress={() => {
                ui.snackbar?.onAction?.();
                ui.dismissSnackbar();
              }}
            >
              <Text style={[styles.buttonText, { color: colors.inversePrimary }]}>{ui.snackbar.actionLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  title: typography.headlineSmall,
  section: { borderRadius: 16, padding: 12, gap: 6 },
  sectionTitle: typography.titleMedium,
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, minHeight: 28, alignItems: 'center' },
  label: { ...typography.bodyMedium, flexShrink: 0 },
  value: { ...typography.bodyMedium, flexShrink: 1, textAlign: 'right' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  buttonText: typography.labelLarge,
  banner: { borderRadius: 16, padding: 12, gap: 8 },
  bannerText: typography.bodyMedium,
  logLine: { ...typography.bodySmall, fontVariant: ['tabular-nums'] },
  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 48,
    borderRadius: 4,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  snackbarText: { ...typography.bodyMedium, flex: 1, paddingVertical: 12 },
  snackbarAction: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
});
