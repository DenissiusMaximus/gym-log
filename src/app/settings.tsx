import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BUILD_TIME, APP_VERSION } from '@/buildInfo.generated';
import { describeSummary, type ParsedBackup } from '@/data/backup';
import { applyBackup, chooseBackupToRestore, saveBackup } from '@/data/backupActions';
import { describeLastBackup } from '@/data/backupStatus';
import { useData } from '@/data/useData';
import { strings } from '@/lib/strings';
import { readStoragePersisted } from '@/pwa/storageStatus';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Icon, type IconName } from '@/ui/Icon';
import { ListItem } from '@/ui/ListItem';
import { SegmentedButtons, type SegmentedOption } from '@/ui/SegmentedButtons';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';
import type { ThemeMode } from '@/data/types';

const s = strings.settings;

const THEME_OPTIONS: readonly SegmentedOption<ThemeMode>[] = [
  { value: 'system', label: s.system },
  { value: 'light', label: s.light },
  { value: 'dark', label: s.dark },
];

/** Taps on the version line that open the developer panel, and the longest pause between them. */
const DEV_TAPS = 7;
const DEV_TAP_GAP_MS = 2000;

/** "2026-11-14T21:14:02.472Z" -> "2026-11-14 21:14 UTC" */
const buildLabel = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="titleSmall" color="primary" accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const themeMode = useData((st) => st.meta.themeMode);
  const lastBackupAt = useData((st) => st.meta.lastBackupAt);

  const [now] = useState(() => new Date());
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const picking = useRef(false);
  const taps = useRef({ count: 0, at: 0 });

  useEffect(() => {
    let alive = true;
    void readStoragePersisted().then((value) => {
      if (alive) setPersisted(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const restore = async () => {
    if (picking.current) return;
    picking.current = true;
    try {
      const parsed = await chooseBackupToRestore();
      if (parsed) {
        setPending(parsed);
        setDialogOpen(true);
      }
    } finally {
      picking.current = false;
    }
  };

  const confirmReplace = () => {
    if (pending) applyBackup(pending);
    setDialogOpen(false);
  };

  const onVersionPress = () => {
    const t = Date.now();
    const state = taps.current;
    state.count = t - state.at > DEV_TAP_GAP_MS ? 1 : state.count + 1;
    state.at = t;
    if (state.count >= DEV_TAPS) {
      state.count = 0;
      router.push('/dev');
    }
  };

  const leading = (name: IconName) => <Icon name={name} color={colors.onSurfaceVariant} />;

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <TopAppBar title={s.title} onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <SectionTitle>{s.theme}</SectionTitle>
        <View style={styles.themeRow} testID="settings-theme">
          <SegmentedButtons
            options={THEME_OPTIONS}
            value={themeMode}
            accessibilityLabel={s.themeLabel}
            onChange={(value) => useData.getState().setMeta({ themeMode: value })}
          />
        </View>

        <SectionTitle>{s.backup}</SectionTitle>
        <View testID="settings-backup-save">
          {/* The handler calls saveBackup directly: Safari needs the share call inside the tap. */}
          <ListItem headline={s.saveToFile} leading={leading('download')} onPress={() => void saveBackup()} />
        </View>
        <View testID="settings-backup-restore">
          <ListItem headline={s.restoreFromFile} leading={leading('upload')} onPress={() => void restore()} />
        </View>
        <View testID="settings-last-backup">
          <ListItem headline={describeLastBackup(lastBackupAt, now)} />
        </View>
        {persisted !== null ? (
          <View testID="settings-storage">
            <ListItem headline={persisted ? s.storageProtected : s.storageStandard} />
            <Text variant="bodyMedium" color="onSurfaceVariant" style={styles.hint}>
              {persisted ? s.storageProtectedHint : s.storageStandardHint}
            </Text>
          </View>
        ) : null}

        <SectionTitle>{s.about}</SectionTitle>
        <View testID="settings-version">
          <ListItem
            headline={s.version(APP_VERSION)}
            supporting={s.build(buildLabel(BUILD_TIME))}
            onPress={onVersionPress}
          />
        </View>
      </ScrollView>

      <Dialog
        visible={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={strings.backup.importTitle}
        actions={
          <>
            <View testID="import-cancel">
              <Button title={strings.common.cancel} variant="text" onPress={() => setDialogOpen(false)} />
            </View>
            <View testID="import-confirm">
              <Button title={strings.backup.replace} variant="text" onPress={confirmReplace} />
            </View>
          </>
        }
      >
        <Text variant="bodyMedium" color="onSurfaceVariant" testID="import-summary">
          {pending ? describeSummary(pending.summary) : ''}
        </Text>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  themeRow: { paddingHorizontal: 16 },
  hint: { paddingHorizontal: 16, paddingBottom: 8 },
});
