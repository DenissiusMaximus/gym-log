import { withSpring, withTiming } from 'react-native-reanimated';

import { reducedMotionDuration, spring, type SpringName } from '../theme/motion';

type Callback = (finished?: boolean) => void;

/**
 * Animates a shared value to `to` with one of the Expressive springs; under reduced motion the
 * spring is replaced by a short timing without overshoot. Usable from worklets.
 */
export function animateTo(to: number, name: SpringName, reduced: boolean, callback?: Callback) {
  'worklet';
  if (reduced) return withTiming(to, { duration: reducedMotionDuration }, callback);
  return withSpring(to, spring[name], callback);
}
