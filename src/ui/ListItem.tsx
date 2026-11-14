import type { ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';

import type { ColorRole } from '../theme/palette.generated';
import { useTheme } from '../theme/ThemeProvider';
import { stateLayer } from '../theme/tokens';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';
import { useFills } from './themed';

type Props = {
  headline: string;
  /** Second line; makes the item 72 dp instead of 56 dp. */
  supporting?: string;
  /** Left slot: an icon, checkbox or avatar. */
  leading?: ReactNode;
  /** Right slot: value, switch, drag handle. */
  trailing?: ReactNode;
  /** Makes the whole row pressable (state layer, accessibility role). */
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** Color of the headline, for example `error` for destructive entries. */
  headlineColor?: ColorRole;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  style?: StyleProp<ViewStyle>;
};

/** MD3 list item: 56 dp with one line, 72 dp with two, 16 dp side padding. */
export function ListItem({
  headline,
  supporting,
  leading,
  trailing,
  onPress,
  selected,
  disabled,
  headlineColor = 'onSurface',
  accessibilityLabel,
  accessibilityRole = 'button',
  style,
}: Props) {
  const { colors } = useTheme();
  const fills = useFills();

  const body = (
    <>
      {leading}
      <View style={styles.texts}>
        <Text variant="bodyLarge" color={headlineColor} numberOfLines={1}>
          {headline}
        </Text>
        {supporting ? (
          <Text variant="bodyMedium" color="onSurfaceVariant" numberOfLines={1}>
            {supporting}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  const rowStyle = [
    styles.row,
    supporting ? styles.twoLine : styles.oneLine,
    selected ? fills.secondaryContainer : null,
    disabled ? styles.disabled : null,
  ];

  if (!onPress) {
    return <View style={[rowStyle, style]}>{body}</View>;
  }

  return (
    <PressableSurface
      onPress={onPress}
      disabled={disabled}
      layerColor={selected ? colors.onSecondaryContainer : colors.onSurface}
      touchStyle={[styles.stretch, style]}
      style={[styles.stretch, rowStyle]}
      minTouchHeight={supporting ? 72 : 56}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? (supporting ? `${headline}, ${supporting}` : headline)}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      {body}
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16 },
  oneLine: { minHeight: 56 },
  twoLine: { minHeight: 72, paddingVertical: 8 },
  stretch: { alignSelf: 'stretch' },
  texts: { flex: 1 },
  disabled: { opacity: stateLayer.disabledContent },
});
