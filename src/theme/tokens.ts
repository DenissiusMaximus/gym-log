import type { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  bold: 'Roboto_700Bold',
} as const;

// Corner radii (dp). Never use `fontWeight` with the custom families above.
export const shape = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

type TypeStyle = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;

const style = (
  weight: keyof typeof fontFamily,
  fontSize: number,
  lineHeight: number,
  letterSpacing: number,
): TypeStyle => ({ fontFamily: fontFamily[weight], fontSize, lineHeight, letterSpacing });

// MD3 type scale.
export const typography = {
  displayLarge: style('regular', 57, 64, -0.25),
  displayMedium: style('regular', 45, 52, 0),
  displaySmall: style('regular', 36, 44, 0),
  headlineLarge: style('regular', 32, 40, 0),
  headlineMedium: style('regular', 28, 36, 0),
  headlineSmall: style('regular', 24, 32, 0),
  titleLarge: style('regular', 22, 28, 0),
  titleMedium: style('medium', 16, 24, 0.15),
  titleSmall: style('medium', 14, 20, 0.1),
  labelLarge: style('medium', 14, 20, 0.1),
  labelMedium: style('medium', 12, 16, 0.5),
  labelSmall: style('medium', 11, 16, 0.5),
  bodyLarge: style('regular', 16, 24, 0.5),
  bodyMedium: style('regular', 14, 20, 0.25),
  bodySmall: style('regular', 12, 16, 0.4),
} as const;

export type TypeVariant = keyof typeof typography;

// Elevation levels 0-5 as a native shadow description (shadow color is the `shadow` role).
export const elevation = {
  level0: { offsetY: 0, blur: 0, opacity: 0, elevation: 0 },
  level1: { offsetY: 1, blur: 3, opacity: 0.15, elevation: 1 },
  level2: { offsetY: 2, blur: 6, opacity: 0.15, elevation: 3 },
  level3: { offsetY: 4, blur: 8, opacity: 0.15, elevation: 6 },
  level4: { offsetY: 6, blur: 10, opacity: 0.15, elevation: 8 },
  level5: { offsetY: 8, blur: 12, opacity: 0.15, elevation: 12 },
} as const;

export type ElevationLevel = keyof typeof elevation;

// State layer opacities applied over the content color.
export const stateLayer = {
  hover: 0.08,
  focus: 0.1,
  pressed: 0.1,
  dragged: 0.16,
  // Pressed overlay used by table cells.
  cellPressed: 0.12,
  scrim: 0.32,
  disabledContent: 0.38,
  disabledContainer: 0.12,
} as const;

// Minimum touch target (dp).
export const touchTarget = 48;
