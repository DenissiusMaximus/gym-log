import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Group } from '../../data/types';
import { strings } from '../../lib/strings';
import { Chip } from '../../ui/Chip';

type Props = {
  /** Groups in chip order (by creation time). */
  groups: readonly Group[];
  /** 'all' or a group id. */
  selected: string;
  onSelect: (filter: string) => void;
  onAddGroup: () => void;
};

const BAR_HEIGHT = 56;

/** Chip row of the manage screen: "All", the groups and, last, the "+ Group" action chip. */
export const ManageChips = memo(function ManageChips({ groups, selected, onSelect, onAddGroup }: Props) {
  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Chip label={strings.manage.filterAll} selected={selected === 'all'} onPress={() => onSelect('all')} />
        {groups.map((group) => (
          <Chip
            key={group.id}
            label={group.name}
            selected={selected === group.id}
            onPress={() => onSelect(group.id)}
          />
        ))}
        <Chip label={strings.manage.addGroup} onPress={onAddGroup} />
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { height: BAR_HEIGHT },
  content: { alignItems: 'center', gap: 8, paddingHorizontal: 16 },
});
