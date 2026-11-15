import { StyleSheet, View } from 'react-native';

import type { IconName } from './Icon';
import { Icon } from './Icon';
import { BottomSheet } from './BottomSheet';
import { ListItem } from './ListItem';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';

export type ActionSheetAction = {
  key: string;
  label: string;
  icon?: IconName;
  onPress: () => void;
  /** Recolors the entry to `error` (delete and similar). */
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: readonly ActionSheetAction[];
};

/** Modal bottom sheet with a list of actions; choosing one closes the sheet and runs the action. */
export function ActionSheet({ visible, onClose, title, actions }: Props) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={title}>
      {title ? (
        <View style={styles.title}>
          <Text variant="titleSmall" color="onSurfaceVariant" numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        </View>
      ) : null}
      {actions.map((action) => (
        <ListItem
          key={action.key}
          headline={action.label}
          headlineColor={action.destructive ? 'error' : 'onSurface'}
          disabled={action.disabled}
          leading={
            action.icon ? (
              <Icon name={action.icon} color={action.destructive ? colors.error : colors.onSurfaceVariant} />
            ) : undefined
          }
          onPress={() => {
            if (!visible) return;
            // The close renders on its own and at once, so the exit animation starts next frame; the heavy action
            // runs a frame later and renders while the sheet is already sliding down on the UI thread.
            // `!visible`: a tap during the exit does not fire a second action.
            onClose();
            requestAnimationFrame(action.onPress);
          }}
        />
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
});
