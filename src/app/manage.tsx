import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectRowIds } from '@/data/selectors';
import { useData } from '@/data/useData';
import { EmptyState } from '@/features/home/EmptyState';
import { ArchiveSection } from '@/features/manage/ArchiveSection';
import { ExerciseEditorDialog } from '@/features/manage/ExerciseEditorDialog';
import { ExerciseRow } from '@/features/manage/ExerciseRow';
import { GroupEditorDialog } from '@/features/manage/GroupEditorDialog';
import { GroupHeader } from '@/features/manage/GroupHeader';
import { GroupMembersSheet } from '@/features/manage/GroupMembersSheet';
import { ManageChips } from '@/features/manage/ManageChips';
import { ReorderList } from '@/features/manage/ReorderList';
import * as haptics from '@/lib/haptics';
import { strings } from '@/lib/strings';
import { useTheme } from '@/theme/ThemeProvider';
import { Fab } from '@/ui/Fab';
import { showSnackbar } from '@/ui/Snackbar';
import { TopAppBar } from '@/ui/TopAppBar';

const s = strings.manage;

const FAB_SIZE = 56;
const FAB_MARGIN = 16;
/** Space under the list that lets the last row scroll clear of the FAB. */
const FAB_CLEARANCE = 88;
/** Snackbars sit this far above the bottom edge so they clear the FAB. */
const FAB_SNACKBAR_OFFSET = 72;
const EMPTY_HEIGHT = 280;

type EditorState = { open: boolean; exerciseId: string | null };
type GroupEditorState = { open: boolean; groupId: string | null };

export default function Manage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ group?: string }>();

  const groups = useData((st) => st.groups);
  const groupList = useMemo(
    () => Object.values(groups).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)),
    [groups],
  );

  // The group named by the route is selected on arrival; a group that no longer exists means "All".
  const [selected, setSelected] = useState(() => (typeof params.group === 'string' ? params.group : 'all'));
  const context = selected !== 'all' && groups[selected] ? selected : 'all';
  const group = context === 'all' ? null : groups[context];

  const rowIds = useData((st) => selectRowIds(st, context));

  const [editor, setEditor] = useState<EditorState>({ open: false, exerciseId: null });
  const [groupEditor, setGroupEditor] = useState<GroupEditorState>({ open: false, groupId: null });
  const [membersOpen, setMembersOpen] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onReorder = useCallback((ordered: string[]) => useData.getState().reorder(context, ordered), [context]);
  const openExercise = useCallback((exerciseId: string) => setEditor({ open: true, exerciseId }), []);
  const renderItem = useCallback(
    (id: string, handle: ReactNode) => (
      <ExerciseRow id={id} handle={handle} showGroups={context === 'all'} onPress={openExercise} />
    ),
    [context, openExercise],
  );

  const deleteGroup = () => {
    if (!group) return;
    const id = group.id;
    const undo = useData.getState().deleteGroup(id);
    setSelected('all');
    haptics.reject();
    showSnackbar({
      text: s.groupDeleted,
      actionLabel: strings.common.undo,
      onAction: () => {
        undo();
        setSelected(id);
      },
      bottomOffset: FAB_SNACKBAR_OFFSET,
    });
  };

  const empty =
    group !== null ? (
      <View style={styles.empty}>
        <EmptyState title={s.emptyGroup} actionLabel={s.addExercises} onAction={() => setMembersOpen(true)} />
      </View>
    ) : (
      <View style={styles.empty}>
        <EmptyState
          title={s.emptyAll}
          actionLabel={s.addExercise}
          onAction={() => setEditor({ open: true, exerciseId: null })}
        />
      </View>
    );

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <TopAppBar title={s.title} onBack={goBack} />
      <ManageChips
        groups={groupList}
        selected={context}
        onSelect={setSelected}
        onAddGroup={() => setGroupEditor({ open: true, groupId: null })}
      />
      {group ? (
        <GroupHeader
          name={group.name}
          onRename={() => setGroupEditor({ open: true, groupId: group.id })}
          onDelete={deleteGroup}
          onEditMembers={() => setMembersOpen(true)}
        />
      ) : null}

      <ReorderList
        ids={rowIds}
        renderItem={renderItem}
        onReorder={onReorder}
        empty={empty}
        footer={context === 'all' ? <ArchiveSection /> : null}
        bottomPadding={FAB_CLEARANCE + insets.bottom}
      />

      <Fab
        icon="add"
        accessibilityLabel={s.newExercise}
        onPress={() => setEditor({ open: true, exerciseId: null })}
        style={[styles.fab, { right: FAB_MARGIN + insets.right, bottom: FAB_MARGIN + insets.bottom }]}
      />

      <ExerciseEditorDialog
        visible={editor.open}
        onClose={() => setEditor((current) => ({ ...current, open: false }))}
        exerciseId={editor.exerciseId}
        defaultGroupId={group ? group.id : null}
        moveContext={context}
        snackbarOffset={FAB_SNACKBAR_OFFSET}
      />
      <GroupEditorDialog
        visible={groupEditor.open}
        onClose={() => setGroupEditor((current) => ({ ...current, open: false }))}
        groupId={groupEditor.groupId}
        onCreated={setSelected}
      />
      <GroupMembersSheet visible={membersOpen} onClose={() => setMembersOpen(false)} groupId={group ? group.id : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fab: { position: 'absolute', width: FAB_SIZE, height: FAB_SIZE },
  empty: { height: EMPTY_HEIGHT },
});
