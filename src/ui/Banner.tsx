import { StyleSheet, View } from 'react-native';

import type { ColorRole } from '../theme/palette.generated';
import { useTheme } from '../theme/ThemeProvider';
import { shape } from '../theme/tokens';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useFills } from './themed';

export type BannerTone = 'error' | 'info' | 'warning';

type Props = {
  text: string;
  tone?: BannerTone;
  actionLabel?: string;
  onAction?: () => void;
};

const LOOK: Record<BannerTone, { container: ColorRole; content: ColorRole; icon: IconName }> = {
  error: { container: 'errorContainer', content: 'onErrorContainer', icon: 'error' },
  info: { container: 'secondaryContainer', content: 'onSecondaryContainer', icon: 'info' },
  warning: { container: 'tertiaryContainer', content: 'onTertiaryContainer', icon: 'warning' },
};

/** Persistent in-content message with an optional action (for example the write-failure banner). */
export function Banner({ text, tone = 'info', actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const fills = useFills();
  const look = LOOK[tone];

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.root, fills[look.container]]}
    >
      <View style={styles.message}>
        <Icon name={look.icon} color={colors[look.content]} />
        <Text variant="bodyMedium" color={look.content} style={styles.text}>
          {text}
        </Text>
      </View>
      {actionLabel ? (
        <View style={styles.action}>
          <Button
            title={actionLabel}
            onPress={onAction}
            variant="filled"
            tone={tone === 'error' ? 'error' : 'default'}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: shape.large, padding: 16, gap: 8 },
  message: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  text: { flex: 1, paddingTop: 2 },
  action: { alignItems: 'flex-end', marginBottom: -8 },
});
