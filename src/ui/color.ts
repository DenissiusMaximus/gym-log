/**
 * Appends an alpha channel to a `#RRGGBB` color. A plain function, not a worklet: never call it
 * inside `useAnimatedStyle` and other worklet contexts (it throws on the UI runtime and is fatal on
 * Android release). Compute it with `useMemo` outside and read the result in the worklet;
 * src/workletSafety.test.ts checks this.
 */
export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}
