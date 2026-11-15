// Spring presets for Reanimated `withSpring({ stiffness, damping, mass: 1 })`.
// damping = 2 * dampingRatio * sqrt(stiffness) for mass 1.
// Motion rule: layout properties (width, height, margin, padding, gap) are animated only with a
// spring without overshoot (layoutFast, effects*) and clamped to >= 0. Overshoot is for transform,
// borderRadius and color only: Yoga on Android treats a negative width as "not set" and measures
// the node by its content, which shows up as a flicker.
export const spring = {
  spatialDefault: { stiffness: 380, damping: 31.2, mass: 1 },
  spatialFast: { stiffness: 800, damping: 33.9, mass: 1 },
  spatialSlow: { stiffness: 200, damping: 22.6, mass: 1 },
  effectsDefault: { stiffness: 1600, damping: 80, mass: 1 },
  effectsFast: { stiffness: 3800, damping: 123.3, mass: 1 },
  // Same speed as spatialFast but critically damped (zeta = 1): width and margin of the check mark.
  layoutFast: { stiffness: 800, damping: 56.6, mass: 1 },
  // Almost no overshoot (zeta ~ 0.9): retargeting the entry panel.
  standardFast: { stiffness: 1400, damping: 67.3, mass: 1 },
} as const;

export type SpringName = keyof typeof spring;

// Replacement for springs when the user prefers reduced motion.
export const reducedMotionDuration = 150;

// Panel dismissal: timing with an accelerating curve (0.3, 0, 0.8, 0.15).
export const exitTiming = {
  duration: 200,
  bezier: [0.3, 0, 0.8, 0.15] as const,
};
