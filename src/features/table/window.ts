import { BUCKET, COL_W, OVERSCAN_WEB } from './metrics';

export type ColumnWindow = {
  first: number;
  /** Inclusive. `last < first` means there is nothing to render. */
  last: number;
};

export type WindowInput = {
  /** Horizontal scroll offset in the column area (0 = oldest column at the left edge of the data area). */
  scrollX: number;
  /** Width of the data area (viewport minus the name column). */
  viewportW: number;
  colW: number;
  total: number;
  overscan: number;
  bucket: number;
};

/** Index of the bucket the scroll offset falls into; the only value the shells keep in state. */
export function bucketIndex(scrollX: number, colW: number, bucket: number): number {
  return Math.max(0, Math.floor(scrollX / (colW * bucket)));
}

/**
 * Columns to mount for a scroll offset. The offset is quantized to `bucket` columns, so the result
 * only changes when the scroll crosses a bucket boundary; the range is wide enough for every
 * offset inside the bucket, plus `overscan` columns on each side.
 */
export function computeWindow({ scrollX, viewportW, colW, total, overscan, bucket }: WindowInput): ColumnWindow {
  if (total <= 0) return { first: 0, last: -1 };
  const start = bucketIndex(scrollX, colW, bucket) * bucket;
  const first = Math.max(0, start - overscan);
  const last = Math.min(total - 1, start + bucket + Math.ceil(viewportW / colW) - 1 + overscan);
  return { first: Math.min(first, total - 1), last };
}

/**
 * Number of column slots in the recycling pool: the widest window `computeWindow` can return.
 * Slot key is `index % poolSize`, so no two columns of one window share a slot.
 */
export function poolSize(
  viewportW: number,
  overscan: number = OVERSCAN_WEB,
  colW: number = COL_W,
  bucket: number = BUCKET,
): number {
  return Math.ceil(Math.max(0, viewportW) / colW) + bucket + 2 * overscan;
}

/** Smallest scroll offset change that brings [start, start + size) fully into view; unchanged if already visible. */
export function revealOffset(start: number, size: number, offset: number, viewSize: number): number {
  if (viewSize <= 0) return offset;
  if (start < offset) return Math.max(0, start);
  if (start + size > offset + viewSize) return Math.max(0, start + size - viewSize);
  return offset;
}

/**
 * True when both lists are non-empty and share no workout: the data was replaced as a whole
 * (import, demo data), so the table should jump to the newest column like on the first open.
 */
export function replacedWholesale(previous: readonly string[], next: readonly string[]): boolean {
  if (previous === next || previous.length === 0 || next.length === 0) return false;
  const known = new Set(previous);
  return !next.some((id) => known.has(id));
}
