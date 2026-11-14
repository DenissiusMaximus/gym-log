import {
  createContext,
  Fragment,
  useContext,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

type Entry = { id: string; node: ReactNode };

class PortalStore {
  private entries: readonly Entry[] = [];
  private listeners = new Set<() => void>();

  set(id: string, node: ReactNode) {
    const index = this.entries.findIndex((entry) => entry.id === id);
    const next = [...this.entries];
    if (index === -1) next.push({ id, node });
    else next[index] = { id, node };
    this.update(next);
  }

  remove(id: string) {
    if (this.entries.some((entry) => entry.id === id)) {
      this.update(this.entries.filter((entry) => entry.id !== id));
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.entries;

  private update(entries: readonly Entry[]) {
    this.entries = entries;
    this.listeners.forEach((listener) => listener());
  }
}

const PortalContext = createContext<PortalStore | null>(null);

/** Holds the overlays registered through `Portal`; render `PortalHost` once inside it. */
export function PortalProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new PortalStore());
  return <PortalContext.Provider value={store}>{children}</PortalContext.Provider>;
}

/** Draws every overlay on top of its siblings. Place it after the screen stack in the root layout. */
export function PortalHost() {
  const store = useContext(PortalContext);
  if (!store) throw new Error('PortalHost must be used inside PortalProvider');
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return (
    <View style={styles.host}>
      {entries.map((entry) => (
        <Fragment key={entry.id}>{entry.node}</Fragment>
      ))}
    </View>
  );
}

/** Renders its children in the `PortalHost` (above the screen) instead of in place. */
export function Portal({ children }: { children: ReactNode }) {
  const store = useContext(PortalContext);
  if (!store) throw new Error('Portal must be used inside PortalProvider');
  const id = useId();

  // Layout effects flush before paint, so a controlled input inside never shows a stale value.
  useLayoutEffect(() => {
    store.set(id, children);
  }, [store, id, children]);
  useLayoutEffect(() => () => store.remove(id), [store, id]);

  return null;
}

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' },
});
