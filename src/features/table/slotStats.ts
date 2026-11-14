// Counts mounted column slots so the spike screen can show that the pool stays bounded.

let mounted = 0;
const listeners = new Set<() => void>();

export function subscribeSlotCount(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSlotCount(): number {
  return mounted;
}

/** Call from an effect: returns the cleanup. */
export function trackSlotMount(): () => void {
  mounted += 1;
  listeners.forEach((l) => l());
  return () => {
    mounted -= 1;
    listeners.forEach((l) => l());
  };
}
