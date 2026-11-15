// Table geometry in dp / CSS px. Shared by both table shells and by the pure window math.

export const NAME_W = 124;
export const COL_W = 60;
export const ROW_H = 44;
export const HEADER_H = 48;
/** Empty space after the last column so it does not hug the screen edge. */
export const TRAIL_PAD = 16;

/** Extra columns mounted on each side of the visible range. Raise it if blank strips show up on a fast fling. */
export const OVERSCAN_WEB = 6;
export const OVERSCAN_NATIVE = 4;
/** The window moves in steps of this many columns (fewer re-renders while scrolling). Lower to 1 for tighter tracking. */
export const BUCKET = 2;

/** Total width of the scrollable content: name column, all date columns, trailing pad. */
export function contentWidth(columnCount: number): number {
  return NAME_W + columnCount * COL_W + TRAIL_PAD;
}

/** Height of the sticky header plus all exercise rows, the "Add exercise" row and the bottom pad. */
export function contentHeight(rowCount: number, bottomPad: number): number {
  return HEADER_H + (rowCount + 1) * ROW_H + bottomPad;
}
