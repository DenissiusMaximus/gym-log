import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { saveBackup } from '@/data/backupActions';
import { useUi } from '@/data/useUi';
import { strings } from '@/lib/strings';
import { useTheme } from '@/theme/ThemeProvider';
import { Banner } from '@/ui/Banner';

/**
 * Lays out the screen stack under the permanent write-failure banner. The banner is part of the
 * layout flow, so it pushes the screens down instead of covering (and blocking) their top bar.
 * While it is visible it takes the top safe-area inset, and the screens below get a zero top
 * inset so they do not pad for the status bar twice. It disappears once saving works again.
 */
export function WriteFailureLayout({ children }: { children: ReactNode }) {
  const failed = useUi((s) => s.persistStatus === 'failed');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const belowInsets = useMemo(() => (failed ? { ...insets, top: 0 } : insets), [failed, insets]);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      {failed ? (
        <View
          testID="write-failure-banner"
          style={{ paddingTop: insets.top + 8, paddingLeft: insets.left + 8, paddingRight: insets.right + 8, paddingBottom: 8 }}
        >
          <Banner
            tone="error"
            text={strings.persist.failedBanner}
            actionLabel={strings.persist.saveCopy}
            onAction={() => void saveBackup()}
          />
        </View>
      ) : null}
      <View style={styles.root}>
        <SafeAreaInsetsContext.Provider value={belowInsets}>{children}</SafeAreaInsetsContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
