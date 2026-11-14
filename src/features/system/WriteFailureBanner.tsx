import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saveBackup } from '@/data/backupActions';
import { useUi } from '@/data/useUi';
import { strings } from '@/lib/strings';
import { Banner } from '@/ui/Banner';

/**
 * Permanent error banner on top of any screen while writes to storage keep failing. It sits below
 * the top safe area so the system status bar stays visible, and disappears once saving works again.
 */
export function WriteFailureBanner() {
  const failed = useUi((s) => s.persistStatus === 'failed');
  const insets = useSafeAreaInsets();
  if (!failed) return null;
  return (
    <View
      testID="write-failure-banner"
      style={[styles.root, { top: insets.top + 8, left: insets.left + 8, right: insets.right + 8 }]}
    >
      <Banner
        tone="error"
        text={strings.persist.failedBanner}
        actionLabel={strings.persist.saveCopy}
        onAction={() => void saveBackup()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', zIndex: 10 },
});
