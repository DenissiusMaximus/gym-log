import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../lib/strings';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton } from './IconButton';
import { Text } from './Text';

type Props = {
  title: string;
  /** Shows the back arrow when set. */
  onBack?: () => void;
  /** Trailing icon buttons. */
  actions?: ReactNode;
  /** Tints the bar (surface-container) when content scrolls under it. */
  scrolled?: boolean;
  /** Adds the top safe-area inset above the 64 dp bar (default true). */
  safeArea?: boolean;
};

const HEIGHT = 64;

/** MD3 small top app bar: 64 dp, title-large, optional back arrow and trailing actions. */
export function TopAppBar({ title, onBack, actions, scrolled = false, safeArea = true }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const containerStyle = useMemo(
    () => ({
      backgroundColor: scrolled ? colors.surfaceContainer : colors.surface,
      paddingTop: safeArea ? insets.top : 0,
    }),
    [scrolled, colors.surfaceContainer, colors.surface, safeArea, insets.top],
  );

  return (
    <View style={containerStyle}>
      <View style={styles.bar}>
        {onBack && (
          <IconButton icon="arrow_back" accessibilityLabel={strings.ui.back} onPress={onBack} />
        )}
        <Text
          variant="titleLarge"
          numberOfLines={1}
          accessibilityRole="header"
          style={[styles.title, onBack ? styles.titleAfterBack : styles.titleAlone]}
        >
          {title}
        </Text>
        {actions}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  title: { flex: 1 },
  titleAfterBack: { marginLeft: 4 },
  titleAlone: { marginLeft: 12 },
});
