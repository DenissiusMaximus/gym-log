// Pure logic of the drag-to-reorder list. Functions used while dragging run on the UI thread, so
// they are worklets: they only touch their arguments.

/** Row index by exercise id. */
export type Positions = Record<string, number>;

export function clampIndex(index: number, count: number): number {
  'worklet';
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

/** Slot a dragged row hovers over, given the top edge of the row (list coordinates). */
export function indexFromTop(top: number, rowHeight: number, count: number): number {
  'worklet';
  return clampIndex(Math.round(top / rowHeight), count);
}

export function positionsFromOrder(ids: readonly string[]): Positions {
  const positions: Positions = {};
  ids.forEach((id, index) => {
    positions[id] = index;
  });
  return positions;
}

/** Ids in the order of their positions. */
export function orderFromPositions(positions: Positions): string[] {
  'worklet';
  const ids = Object.keys(positions);
  ids.sort((a, b) => positions[a] - positions[b]);
  return ids;
}

/** Moves `activeId` to `target`; rows between the old and the new slot shift by one. */
export function shiftPositions(positions: Positions, activeId: string, target: number): Positions {
  'worklet';
  const from = positions[activeId];
  if (from === undefined || from === target) return positions;
  const next: Positions = {};
  for (const id of Object.keys(positions)) {
    const position = positions[id];
    if (id === activeId) next[id] = target;
    else if (from < target && position > from && position <= target) next[id] = position - 1;
    else if (from > target && position >= target && position < from) next[id] = position + 1;
    else next[id] = position;
  }
  return next;
}

/**
 * Auto-scroll speed as a ratio in [-1, 1]: negative scrolls up, positive scrolls down. It grows
 * linearly from 0 at `edge` dp from the viewport border to 1 at the border itself.
 */
export function autoScrollRatio(fingerY: number, viewportHeight: number, edge: number): number {
  'worklet';
  if (fingerY < edge) return -Math.min(1, (edge - fingerY) / edge);
  if (fingerY > viewportHeight - edge) return Math.min(1, (fingerY - (viewportHeight - edge)) / edge);
  return 0;
}

/** `ids` with `id` moved by `delta` places; `null` when that would leave the list or `id` is absent. */
export function moveBy(ids: readonly string[], id: string, delta: number): string[] | null {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
