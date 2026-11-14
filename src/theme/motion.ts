// Spring presets for Reanimated `withSpring({ stiffness, damping, mass: 1 })`.
// damping = 2 * dampingRatio * sqrt(stiffness) for mass 1.
export const spring = {
  spatialDefault: { stiffness: 380, damping: 31.2, mass: 1 },
  spatialFast: { stiffness: 800, damping: 33.9, mass: 1 },
  spatialSlow: { stiffness: 200, damping: 22.6, mass: 1 },
  effectsDefault: { stiffness: 1600, damping: 80, mass: 1 },
  effectsFast: { stiffness: 3800, damping: 123.3, mass: 1 },
  // Critically damped (no overshoot): retargeting the entry panel.
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
