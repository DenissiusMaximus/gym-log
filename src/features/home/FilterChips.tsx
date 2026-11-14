import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Group } from '../../data/types';
import { strings } from '../../lib/strings';
import { useTheme } from '../../theme/ThemeProvider';
import { Chip } from '../../ui/Chip';
import { IconButton } from '../../ui/IconButton';

type Props = {
  /** Groups in chip order (by creation time). */
  groups: readonly Group[];
  /** 'all' or a group id. */
  filter: string;
  onSelect: (filter: string) => void;
  onMore: () => void;
};

const BAR_HEIGHT = 56;
const FADE_WIDTH = 16;
const MORE_SIZE = 48;

/** Fade from transparent to the surface color, drawn over the chips before the "more" button. */
function Fade() {
  const { colors } = useTheme();
  return (
    <View style={styles.fade}>
      <Svg width={FADE_WIDTH} height={BAR_HEIGHT} accessible={false}>
        <Defs>
          <LinearGradient id="chips-fade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.surface} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.surface} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={FADE_WIDTH} height={BAR_HEIGHT} fill="url(#chips-fade)" />
      </Svg>
    </View>
  );
}

/**
 * Top row of the home screen (56 dp): single-choice filter chips that scroll horizontally and a fixed
 * "more" button. There is no app title.
 */
export const FilterChips = memo(function FilterChips({ groups, filter, onSelect, onMore }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.chips}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Chip label={strings.home.filterAll} selected={filter === 'all'} onPress={() => onSelect('all')} />
          {groups.map((group) => (
            <Chip
              key={group.id}
              label={group.name}
              selected={filter === group.id}
              onPress={() => onSelect(group.id)}
            />
          ))}
        </ScrollView>
        <Fade />
      </View>
      <IconButton icon="more_vert" accessibilityLabel={strings.home.more} onPress={onMore} style={styles.more} />
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  chips: { flex: 1, height: BAR_HEIGHT },
  // 16 dp on the left, and a trailing space so the last chip can scroll clear of the fade.
  content: { alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16 + FADE_WIDTH },
  fade: { position: 'absolute', top: 0, right: 0, width: FADE_WIDTH, height: BAR_HEIGHT, pointerEvents: 'none' },
  more: { width: MORE_SIZE, height: MORE_SIZE, marginRight: 4 },
});
