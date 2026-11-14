import type { ViewStyle } from 'react-native';

import { elevation, type ElevationLevel } from '../theme/tokens';
import { withAlpha } from './color';

/** Cross-platform shadow for an MD3 elevation level; `up` casts it upwards (bottom sheets). */
export function shadow(level: ElevationLevel, shadowColor: string, up = false): ViewStyle {
  const { offsetY, blur, opacity } = elevation[level];
  if (opacity === 0) return {};
  return {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: up ? -offsetY : offsetY,
        blurRadius: blur,
        spreadDistance: 0,
        color: withAlpha(shadowColor, opacity),
      },
    ],
  };
}
