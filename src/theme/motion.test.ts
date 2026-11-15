import { spring } from './motion';

const dampingRatio = ({ stiffness, damping, mass }: { stiffness: number; damping: number; mass: number }) =>
  damping / (2 * Math.sqrt(stiffness * mass));

describe('spring presets', () => {
  it.each(['layoutFast', 'effectsDefault', 'effectsFast'] as const)('%s does not overshoot', (name) => {
    expect(dampingRatio(spring[name])).toBeGreaterThanOrEqual(1 - 0.005);
  });
});
