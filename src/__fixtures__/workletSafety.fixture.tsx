// Negative fixture for src/workletSafety.test.ts: every line marked `expect-violation` must be
// reported, every other line must stay clean. The file is never imported by the app.
import { AndroidHaptics, performAndroidHapticsAsync } from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePanGesture } from 'react-native-gesture-handler';
import {
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { clampIndex } from '../features/manage/reorderMath';
import * as haptics from '../lib/haptics';
import { animateTo } from '../ui/animate';
import { withAlpha } from '../ui/color';

export function WorkletSafetyFixture(props: { onClose: () => void; color: string }) {
  const { onClose, color } = props;
  const value = useSharedValue(0);
  const [, setCount] = useState(0);
  const plainFn = () => undefined;
  const plainCallback = useCallback(() => 1, []);
  const clear = useMemo(() => withAlpha(color, 0), [color]);

  // Violations.
  const bad1 = useAnimatedStyle(() => ({
    color: interpolateColor(value.get(), [0, 1], [withAlpha(color, 0), color]), // expect-violation
  }));
  const bad2 = usePanGesture({
    onDeactivate: () => {
      'worklet';
      onClose(); // expect-violation
    },
  });
  useAnimatedReaction(
    () => value.get(),
    (next) => setCount(next), // expect-violation
  );
  const bad3 = useDerivedValue(() => haptics.key()); // expect-violation
  const bad4 = useAnimatedStyle(() => ({ width: plainCallback() })); // expect-violation
  const bad5 = useDerivedValue(() => String(performAndroidHapticsAsync(AndroidHaptics.Confirm))); // expect-violation
  useEffect(() => {
    animateTo(1, 'spatialFast', false, () => undefined); // expect-violation
  }, []);

  // Clean code.
  const good1 = usePanGesture({
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(onClose);
    },
  });
  const good2 = useAnimatedStyle(() => {
    const half = (n: number) => n / 2;
    value.set(animateTo(1, 'spatialFast', false));
    return {
      width: clampIndex(Math.min(half(2), 3), 4),
      color: interpolateColor(value.get(), [0, 1], [clear, color]),
    };
  });
  const good3 = usePanGesture({ runOnJS: true, onActivate: () => plainFn() });

  return { bad1, bad2, bad3, bad4, bad5, good1, good2, good3 };
}
