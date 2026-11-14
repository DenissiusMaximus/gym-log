import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { selectRowIds } from '../../data/selectors';
import { useData } from '../../data/useData';
import { strings } from '../../lib/strings';
import { BottomSheet } from '../../ui/BottomSheet';
import { Checkbox } from '../../ui/Checkbox';
import { Text } from '../../ui/Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  groupId: string | null;
};

const s = strings.manage;
const MAX_LIST_FRACTION = 0.6;

function Members({ groupId }: { groupId: string }) {
  const { height } = useWindowDimensions();
  const exerciseIds = useData((state) => selectRowIds(state, 'all'));
  const members = useData((state) => state.memberships[groupId]);
  const names = useData((state) => state.exercises);

  const toggle = (exerciseId: string, checked: boolean) => {
    const state = useData.getState();
    // Keep every current member, archived ones included: only the toggled exercise changes.
    const current = Object.keys(state.memberships[groupId] ?? {});
    const next = checked ? [...current, exerciseId] : current.filter((id) => id !== exerciseId);
    state.setGroupMembers(groupId, next);
  };

  return (
    <>
      <View style={styles.title}>
        <Text variant="titleMedium" accessibilityRole="header">
          {s.groupExercises}
        </Text>
      </View>
      {exerciseIds.length === 0 ? (
        <Text variant="bodyMedium" color="onSurfaceVariant" style={styles.empty}>
          {s.noActiveExercises}
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: height * MAX_LIST_FRACTION }} showsVerticalScrollIndicator={false}>
          {exerciseIds.map((id) => (
            <Checkbox
              key={id}
              label={names[id]?.name ?? ''}
              checked={members?.[id] !== undefined}
              onChange={(checked) => toggle(id, checked)}
            />
          ))}
        </ScrollView>
      )}
      <View style={styles.bottom} />
    </>
  );
}

/** Modal sheet that lists every active exercise with a checkbox; each change is applied at once. */
export function GroupMembersSheet({ visible, onClose, groupId }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={s.groupExercises}>
      {groupId ? <Members groupId={groupId} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  empty: { paddingHorizontal: 16, paddingVertical: 12 },
  bottom: { height: 8 },
});
