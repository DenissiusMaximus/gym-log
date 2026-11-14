import { StyleSheet, View } from 'react-native';

import { strings } from '../../lib/strings';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Text } from '../../ui/Text';

type Props = {
  name: string;
  onRename: () => void;
  onDelete: () => void;
  onEditMembers: () => void;
};

const s = strings.manage;

/** Shown under the chips while a group is selected: its name, rename and delete, and the members button. */
export function GroupHeader({ name, onRename, onDelete, onEditMembers }: Props) {
  return (
    <View style={styles.root} testID="group-header">
      <View style={styles.titleRow}>
        <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
          {name}
        </Text>
        <IconButton icon="edit" accessibilityLabel={s.renameGroup} onPress={onRename} />
        <IconButton icon="delete" accessibilityLabel={s.deleteGroup} onPress={onDelete} />
      </View>
      <Button title={s.groupExercises} variant="tonal" onPress={onEditMembers} style={styles.members} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingLeft: 16, paddingRight: 8, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  title: { flex: 1 },
  members: { alignSelf: 'flex-start' },
});
