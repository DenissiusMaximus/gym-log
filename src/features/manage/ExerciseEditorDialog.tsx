import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { selectRowIds } from '../../data/selectors';
import { useData } from '../../data/useData';
import { useUi } from '../../data/useUi';
import * as haptics from '../../lib/haptics';
import { strings } from '../../lib/strings';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/Dialog';
import { IconButton } from '../../ui/IconButton';
import { showSnackbar } from '../../ui/Snackbar';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { checkExerciseName } from './exerciseName';
import { moveBy } from './reorderMath';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The exercise to edit; `null` creates a new one. Read when the dialog opens. */
  exerciseId: string | null;
  /** Group that starts checked for a new exercise (the active filter). */
  defaultGroupId?: string | null;
  /**
   * Shows "Move up" / "Move down" buttons that reorder the exercise within this context ('all' or a
   * group id). A fallback for devices where dragging the handle does not work.
   */
  moveContext?: string;
  /** Extra distance above the bottom edge for the "archived" snackbar (for example above a FAB). */
  snackbarOffset?: number;
};

const s = strings.exerciseEditor;
const ui = strings.ui;

// The form state lives here, in a component that is created anew on every opening, so a reopened
// dialog never shows what the previous opening left behind.
function EditorBody({ visible, onClose, exerciseId, defaultGroupId, moveContext, snackbarOffset }: Props) {
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

  const contextIds = useData((st) => selectRowIds(st, moveContext ?? 'all'));
  const position = target ? contextIds.indexOf(target) : -1;
  const showMove = moveContext !== undefined && target !== null;

  const problem = checkExerciseName(name, exercises, target);
  // Reordering applies at once, like dragging; only name and groups wait for "Done".
  const move = (delta: -1 | 1) => {
    if (!target || moveContext === undefined) return;
    const next = moveBy(contextIds, target, delta);
    if (!next) return;
    useData.getState().reorder(moveContext, next);
    haptics.dragStep();
  };
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
        {showMove ? (
          <View style={styles.order}>
            <Text variant="labelLarge" color="onSurfaceVariant" style={styles.orderTitle}>
              {s.order}
            </Text>
            <IconButton
              icon="arrow_upward"
              accessibilityLabel={s.moveUp}
              disabled={position <= 0}
              onPress={() => move(-1)}
            />
            <IconButton
              icon="arrow_downward"
              accessibilityLabel={s.moveDown}
              disabled={position === -1 || position >= contextIds.length - 1}
              onPress={() => move(1)}
            />
          </View>
        ) : null}
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
  order: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 },
  orderTitle: { flex: 1 },
  groupsTitle: { paddingHorizontal: 4, paddingVertical: 8 },
  spacer: { flex: 1 },
});
