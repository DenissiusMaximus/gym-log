import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useData } from '../../data/useData';
import { useUi } from '../../data/useUi';
import * as haptics from '../../lib/haptics';
import { strings } from '../../lib/strings';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/Dialog';
import { showSnackbar } from '../../ui/Snackbar';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { checkExerciseName } from './exerciseName';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The exercise to edit; `null` creates a new one. Read when the dialog opens. */
  exerciseId: string | null;
  /** Group that starts checked for a new exercise (the active filter). */
  defaultGroupId?: string | null;
  /** Extra distance above the bottom edge for the "archived" snackbar (for example above a FAB). */
  snackbarOffset?: number;
};

const s = strings.exerciseEditor;
const ui = strings.ui;

// The form state lives here, in a component that is created anew on every opening, so a reopened
// dialog never shows what the previous opening left behind.
function EditorBody({ visible, onClose, exerciseId, defaultGroupId, snackbarOffset }: Props) {
  const [target] = useState(exerciseId);
  const [name, setName] = useState(() => (exerciseId ? (useData.getState().exercises[exerciseId]?.name ?? '') : ''));
  const [groupIds, setGroupIds] = useState<ReadonlySet<string>>(() => {
    const { memberships } = useData.getState();
    if (exerciseId) {
      return new Set(Object.keys(memberships).filter((groupId) => memberships[groupId][exerciseId] !== undefined));
    }
    return new Set(defaultGroupId ? [defaultGroupId] : []);
  });

  const exercises = useData((st) => st.exercises);
  const groups = useData((st) => st.groups);
  const groupList = useMemo(
    () => Object.values(groups).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)),
    [groups],
  );

  const problem = checkExerciseName(name, exercises, target);
  const toggleGroup = (groupId: string, checked: boolean) => {
    setGroupIds((current) => {
      const next = new Set(current);
      if (checked) next.add(groupId);
      else next.delete(groupId);
      return next;
    });
  };

  const save = () => {
    if (problem !== null) return;
    const state = useData.getState();
    // Only groups that still exist are written (a group may be deleted while the dialog is open).
    const ids = [...groupIds].filter((id) => state.groups[id]);
    if (target) state.updateExercise(target, { name, groupIds: ids });
    else state.addExercise(name, ids);
    haptics.confirm();
    onClose();
  };

  const archive = () => {
    if (!target) return;
    const state = useData.getState();
    state.archiveExercise(target);
    const { selectedCell, setSelectedCell } = useUi.getState();
    if (selectedCell?.exerciseId === target) setSelectedCell(null);
    haptics.reject();
    showSnackbar({
      text: s.archived,
      actionLabel: strings.common.undo,
      onAction: () => useData.getState().unarchiveExercise(target),
      bottomOffset: snackbarOffset,
    });
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      anchor="top"
      title={target ? s.editTitle : s.newTitle}
      actions={
        <>
          {target ? <Button title={s.archive} variant="text" onPress={archive} /> : null}
          <View style={styles.spacer} />
          <Button title={ui.cancel} variant="text" onPress={onClose} />
          <Button title={ui.done} variant="text" disabled={problem !== null} onPress={save} />
        </>
      }
    >
      <View style={styles.form}>
        <TextField
          label={s.name}
          value={name}
          onChangeText={setName}
          error={problem === 'duplicate' ? s.duplicate : undefined}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
        />
        {groupList.length > 0 ? (
          <View style={styles.groups}>
            <Text variant="labelLarge" color="onSurfaceVariant" style={styles.groupsTitle}>
              {s.groups}
            </Text>
            {groupList.map((group) => (
              <Checkbox
                key={group.id}
                label={group.name}
                checked={groupIds.has(group.id)}
                onChange={(checked) => toggleGroup(group.id, checked)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Dialog>
  );
}

/** Creates or edits an exercise: name, group membership and, for an existing one, archiving. */
export function ExerciseEditorDialog(props: Props) {
  const [opening, setOpening] = useState(0);
  const [wasVisible, setWasVisible] = useState(props.visible);
  if (props.visible !== wasVisible) {
    setWasVisible(props.visible);
    if (props.visible) setOpening((n) => n + 1);
  }
  return <EditorBody key={opening} {...props} />;
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  groups: { gap: 0 },
  groupsTitle: { paddingHorizontal: 4, paddingVertical: 8 },
  spacer: { flex: 1 },
});
