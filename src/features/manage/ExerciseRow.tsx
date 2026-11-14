import { memo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { useData } from '../../data/useData';
import { strings } from '../../lib/strings';
import { useTheme } from '../../theme/ThemeProvider';
import { PressableSurface } from '../../ui/PressableSurface';
import { Text } from '../../ui/Text';
import { groupNamesFor } from './groupLabels';
import { ROW_HEIGHT } from './ReorderList';

type Props = {
  id: string;
  /** The drag handle supplied by `ReorderList`. */
  handle: ReactNode;
  /** Shows the names of the exercise's groups under its name (the "All" view). */
  showGroups: boolean;
  onPress: (id: string) => void;
};

/** One row of the exercise list: name (and groups) on the left, the drag handle on the right. */
export const ExerciseRow = memo(function ExerciseRow({ id, handle, showGroups, onPress }: Props) {
  const { colors } = useTheme();
  const name = useData((state) => state.exercises[id]?.name ?? '');
  // A string, so the selector is stable and re-renders the row only when the labels change.
  const groups = useData((state) => (showGroups ? groupNamesFor(state, id) : ''));

  return (
    <>
      <PressableSurface
        onPress={() => onPress(id)}
        layerColor={colors.onSurface}
        touchStyle={styles.touch}
        style={styles.body}
        minTouchHeight={ROW_HEIGHT}
        accessibilityLabel={strings.manage.exerciseLabel(name, groups)}
      >
        <Text variant="bodyLarge" numberOfLines={1} style={styles.text}>
          {name}
        </Text>
        {groups ? (
          <Text variant="bodySmall" color="onSurfaceVariant" numberOfLines={1} style={styles.text}>
            {groups}
          </Text>
        ) : null}
      </PressableSurface>
      {handle}
    </>
  );
});

const styles = StyleSheet.create({
  touch: { flex: 1, alignSelf: 'stretch' },
  body: {
    alignSelf: 'stretch',
    height: ROW_HEIGHT,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 8,
  },
  text: { alignSelf: 'stretch' },
});
