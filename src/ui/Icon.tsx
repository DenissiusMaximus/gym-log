import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { ICON_VIEW_BOX, icons, type IconName } from './icons.generated';

export type { IconName };

type Props = {
  name: IconName;
  /** dp; defaults to the MD3 24 dp glyph. */
  size?: number;
  /** Resolved color; defaults to `on-surface`. */
  color?: string;
};

/** Decorative Material Symbols glyph; the control that contains it carries the accessibility label. */
export function Icon({ name, size = 24, color }: Props) {
  const { colors } = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox={ICON_VIEW_BOX}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Path d={icons[name]} fill={color ?? colors.onSurface} />
    </Svg>
  );
}
