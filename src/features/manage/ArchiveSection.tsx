import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useData } from '../../data/useData';
import * as haptics from '../../lib/haptics';
import { strings } from '../../lib/strings';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { PressableSurface } from '../../ui/PressableSurface';
import { Text } from '../../ui/Text';
import { ROW_HEIGHT } from './ReorderList';

const s = strings.manage;

/** Collapsible "Archive (n)" section: archived exercises with a Restore button. Hidden when empty. */
export function ArchiveSection() {
  const { colors } = useTheme();
  const exercises = useData((state) => state.exercises);
  const [open, setOpen] = useState(false);

  const archived = useMemo(
    () =>
      Object.values(exercises)
        .filter((exercise) => exercise.archivedAt !== null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [exercises],
  );
  if (archived.length === 0) return null;

  return (
    <View style={[styles.root, { borderTopColor: colors.outlineVariant }]} testID="archive-section">
      <PressableSurface
        onPress={() => setOpen((value) => !value)}
        layerColor={colors.onSurface}
        touchStyle={styles.headerTouch}
        style={styles.header}
        minTouchHeight={ROW_HEIGHT}
        accessibilityLabel={s.archive(archived.length)}
        accessibilityState={{ expanded: open }}
      >
        <Text variant="titleSmall" color="onSurfaceVariant" style={styles.headerText}>
          {s.archive(archived.length)}
        </Text>
        <View style={open ? styles.flipped : undefined}>
          <Icon name="expand_more" color={colors.onSurfaceVariant} />
        </View>
      </PressableSurface>
      {open
        ? archived.map((exercise) => (
            <View key={exercise.id} style={styles.item} testID={`archived-${exercise.id}`}>
              <Text variant="bodyLarge" color="onSurfaceVariant" numberOfLines={1} style={styles.itemName}>
                {exercise.name}
              </Text>
              <Button
                title={s.restore}
                variant="text"
                accessibilityLabel={s.restoreLabel(exercise.name)}
                onPress={() => {
                  haptics.confirm();
                  useData.getState().unarchiveExercise(exercise.id);
                }}
              />
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 8, borderTopWidth: 1 },
  headerTouch: { alignSelf: 'stretch' },
  header: {
    alignSelf: 'stretch',
    height: ROW_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerText: { flex: 1 },
  flipped: { transform: [{ rotate: '180deg' }] },
  item: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  itemName: { flex: 1 },
});
