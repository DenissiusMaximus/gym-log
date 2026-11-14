// Haptic feedback table (plan 8.7). Android uses the system haptic constants; iOS native gets
// its own implementation here later, until then it stays silent like the web build.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function perform(type: Haptics.AndroidHaptics) {
  if (Platform.OS !== 'android') return;
  // A failed haptic must never break the interaction that triggered it.
  Haptics.performAndroidHapticsAsync(type).catch(() => {});
}

/** Tap on a table cell. */
export const tapCell = () => perform(Haptics.AndroidHaptics.Context_Click);
/** Plus and minus buttons. */
export const tick = () => perform(Haptics.AndroidHaptics.Clock_Tick);
/** Keys of the numeric keypad. */
export const key = () => perform(Haptics.AndroidHaptics.Keyboard_Tap);
/** Workout created, date set, "Done". */
export const confirm = () => perform(Haptics.AndroidHaptics.Confirm);
/** Start of a drag. */
export const dragStart = () => perform(Haptics.AndroidHaptics.Drag_Start);
/** Every position change during a drag; point change while scrubbing a chart. */
export const dragStep = () => perform(Haptics.AndroidHaptics.Segment_Tick);
/** Deletion. */
export const reject = () => perform(Haptics.AndroidHaptics.Reject);
