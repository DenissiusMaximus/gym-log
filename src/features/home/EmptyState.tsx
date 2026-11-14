import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { useTheme } from '../../theme/ThemeProvider';
import { animateTo } from '../../ui/animate';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { Text } from '../../ui/Text';

type Props = {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel: string;
  onAction: () => void;
};

/** Centered empty state; fades and rises in with the slow spatial spring. */
export function EmptyState({ icon, title, body, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(animateTo(1, 'spatialSlow', reduced));
  }, [progress, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.get())),
    transform: [{ translateY: 16 * (1 - progress.get()) }],
  }));

  return (
    <Animated.View style={[styles.root, style]}>
      {icon ? <Icon name={icon} size={48} color={colors.onSurfaceVariant} /> : null}
      <Text variant="headlineSmall" style={styles.center} accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="bodyMedium" color="onSurfaceVariant" style={styles.center}>
          {body}
        </Text>
      ) : null}
      <Button title={actionLabel} onPress={onAction} style={styles.action} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  center: { textAlign: 'center', maxWidth: 360 },
  action: { marginTop: 12 },
});
