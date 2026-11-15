import { useState } from 'react';

import { useData } from '../../data/useData';
import * as haptics from '../../lib/haptics';
import { strings } from '../../lib/strings';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { TextField } from '../../ui/TextField';
import { checkGroupName } from './groupName';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The group to rename; `null` creates a new one. Read when the dialog opens. */
  groupId: string | null;
  /** Called with the id of a group that was just created. */
  onCreated?: (groupId: string) => void;
};

const s = strings.groupEditor;
const ui = strings.ui;

// The field state lives in a component that is created anew on every opening (see ExerciseEditorDialog).
function EditorBody({ visible, onClose, groupId, onCreated }: Props) {
  const [target] = useState(groupId);
  const [name, setName] = useState(() => (groupId ? (useData.getState().groups[groupId]?.name ?? '') : ''));
  const groups = useData((state) => state.groups);

  // After saving, the dialog still fades out for a moment; the live `groups` already contains the
  // new name, so the duplicate error must not flash and a second tap must not save twice.
  const [saved, setSaved] = useState(false);
  const problem = saved ? null : checkGroupName(name, groups, target);

  const save = () => {
    if (saved || problem !== null) return;
    setSaved(true);
    const state = useData.getState();
    if (target) state.renameGroup(target, name);
    else onCreated?.(state.addGroup(name));
    haptics.confirm();
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      anchor="top"
      title={target ? s.renameTitle : s.newTitle}
      actions={
        <>
          <Button title={ui.cancel} variant="text" onPress={onClose} />
          <Button title={ui.done} variant="text" disabled={problem !== null} onPress={save} />
        </>
      }
    >
      <TextField
        label={s.name}
        value={name}
        onChangeText={setName}
        error={problem === 'duplicate' ? s.duplicate : undefined}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
      />
    </Dialog>
  );
}

/** Creates a group or renames an existing one. Group names are unique (case and spaces ignored). */
export function GroupEditorDialog(props: Props) {
  const [opening, setOpening] = useState(0);
  const [wasVisible, setWasVisible] = useState(props.visible);
  if (props.visible !== wasVisible) {
    setWasVisible(props.visible);
    if (props.visible) setOpening((n) => n + 1);
  }
  return <EditorBody key={opening} {...props} />;
}
