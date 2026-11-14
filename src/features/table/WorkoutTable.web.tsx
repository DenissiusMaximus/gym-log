// DOM implementation. One scroll container on both axes; the header, the corner and the name column
// are `position: sticky`, so the compositor pins them with no JS per scroll event. JS only
// recomputes which date columns to mount (a pool of recycled slots).
import {
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { cellValue } from '../../data/selectors';
import { useData } from '../../data/useData';
import { formatLongDate } from '../../lib/date';
import { formatWeight } from '../../lib/format';
import { strings } from '../../lib/strings';
import { cellLabel, dotsFor, headerLabel } from './labels';
import {
  BUCKET,
  COL_W,
  HEADER_H,
  NAME_W,
  OVERSCAN_WEB,
  ROW_H,
  TRAIL_PAD,
  contentHeight,
  contentWidth,
} from './metrics';
import css from './table.module.css';
import type { RowInfo, WorkoutTableProps } from './types';
import { bucketIndex, computeWindow, poolSize, replacedWholesale, revealOffset } from './window';

const CELL = css.cell;
const CELL_SELECTED = `${css.cell} ${css.selected}`;
// Column class by [today][undated]: precomputed so slots do no string work per render.
const COL_CLASS = [
  [css.col, `${css.col} ${css.undated}`],
  [`${css.col} ${css.today}`, `${css.col} ${css.today} ${css.undated}`],
] as const;

type ColumnSlotProps = {
  workoutId: string;
  rows: RowInfo[];
  x: number;
  today: string;
  selectedExerciseId: string | null;
};

// One subscription for the cells: replacing `entries[workoutId]` re-renders exactly this slot.
// The date is a second, primitive subscription that only fires when the workout's date changes.
const ColumnSlot = memo(function ColumnSlot({ workoutId, rows, x, today, selectedExerciseId }: ColumnSlotProps) {
  const byExercise = useData((s) => s.entries[workoutId]);
  const date = useData((s) => s.workouts[workoutId]?.date ?? null);

  const cells = [];
  for (const row of rows) {
    const weights = byExercise?.[row.id]?.weights;
    let content = null;
    if (weights) {
      const { dots, plus } = dotsFor(weights.length);
      content = (
        <>
          {formatWeight(cellValue(weights))}
          {dots > 0 && (
            <span className={css.dots}>
              {Array.from({ length: dots }, (_, i) => (
                <span key={i} className={css.dot} />
              ))}
              {plus && <span className={css.plus}>+</span>}
            </span>
          )}
        </>
      );
    }
    cells.push(
      <div
        key={row.id}
        className={row.id === selectedExerciseId ? CELL_SELECTED : CELL}
        role="button"
        aria-label={cellLabel(row.name, date, weights)}
        data-w={workoutId}
        data-e={row.id}
      >
        {content}
      </div>,
    );
  }

  return (
    <div
      className={COL_CLASS[date === today ? 1 : 0][date === null ? 1 : 0]}
      style={{ transform: `translateX(${x}px)` }}
    >
      {cells}
    </div>
  );
});

type HeaderSlotProps = { workoutId: string; x: number; today: string };

const HeaderSlot = memo(function HeaderSlot({ workoutId, x, today }: HeaderSlotProps) {
  const date = useData((s) => s.workouts[workoutId]?.date ?? null);
  const label = headerLabel(date, today);
  return (
    <div
      className={css.hcell}
      style={{ transform: `translateX(${x}px)` }}
      role="button"
      aria-label={date === null ? strings.table.noDate : formatLongDate(date)}
      data-h={workoutId}
    >
      {label.date === null ? (
        <div className={css.noDate}>
          {strings.table.noDateTop}
          <br />
          {strings.table.noDateBottom}
        </div>
      ) : (
        <>
          <div className={date === today ? `${css.date} ${css.datePill}` : css.date}>{label.date}</div>
          <div className={css.sub}>{label.sub}</div>
        </>
      )}
    </div>
  );
});

const NameColumn = memo(function NameColumn({ rows }: { rows: RowInfo[] }) {
  return (
    <div className={css.nameCol} style={{ height: (rows.length + 1) * ROW_H }}>
      {rows.map((row) => (
        <div key={row.id} className={css.name} role="button" data-n={row.id}>
          <span className={css.nameText}>{row.name}</span>
        </div>
      ))}
      <div className={css.add} role="button" data-add="">
        {strings.table.addExercise}
      </div>
    </div>
  );
});

// iOS Safari applies :active only when some touchstart listener exists up the tree.
const noop = () => {};

export function WorkoutTable({
  rowIds,
  columnIds,
  today,
  selectedCell,
  bottomPad,
  onCellPress,
  onHeaderPress,
  onNamePress,
  onAddExercise,
  ref,
}: WorkoutTableProps) {
  const exercises = useData((s) => s.exercises);
  const rows = useMemo<RowInfo[]>(
    () => rowIds.map((id) => ({ id, name: exercises[id]?.name ?? '' })),
    [rowIds, exercises],
  );
  const total = columnIds.length;
  const reduced = useReducedMotion();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const pinnedToEnd = useRef(false);
  // First paint assumes the window width and the right edge, so the layout effect below
  // corrects an already nearly right frame instead of a jump from the left edge.
  const [viewportW, setViewportW] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));
  const [bucket, setBucket] = useState(() =>
    bucketIndex(Math.max(0, total * COL_W + TRAIL_PAD - (viewportW - NAME_W)), COL_W, BUCKET),
  );
  const bucketRef = useRef(bucket);

  // Newest dates are on the right: start there, and again when the table goes from empty to filled
  // or when the data is replaced wholesale (import, demo data: no column survives).
  const previousColumns = useRef(columnIds);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (replacedWholesale(previousColumns.current, columnIds)) pinnedToEnd.current = false;
    previousColumns.current = columnIds;
    if (total === 0) {
      pinnedToEnd.current = false;
      return;
    }
    if (pinnedToEnd.current) return;
    pinnedToEnd.current = true;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
    const next = bucketIndex(el.scrollLeft, COL_W, BUCKET);
    bucketRef.current = next;
    setBucket(next);
    setViewportW(el.clientWidth);
  }, [columnIds, total]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewportW(el.clientWidth));
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // At most one computation per frame; state changes only when the scroll crosses a bucket boundary.
  const onScroll = () => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const el = scrollerRef.current;
      if (!el) return;
      const next = bucketIndex(el.scrollLeft, COL_W, BUCKET);
      if (next === bucketRef.current) return;
      bucketRef.current = next;
      setBucket(next);
    });
  };

  const dataW = Math.max(0, viewportW - NAME_W);
  const win = computeWindow({
    scrollX: bucket * COL_W * BUCKET,
    viewportW: dataW,
    colW: COL_W,
    total,
    overscan: OVERSCAN_WEB,
    bucket: BUCKET,
  });
  const pool = poolSize(dataW, OVERSCAN_WEB);
  const firstKey = win.first % pool;

  const bodySlots = [];
  const headerSlots = [];
  for (let key = 0; key < pool; key++) {
    const index = win.first + ((key - firstKey + pool) % pool);
    if (index > win.last) continue;
    const workoutId = columnIds[index];
    bodySlots.push(
      <ColumnSlot
        key={key}
        workoutId={workoutId}
        rows={rows}
        x={index * COL_W}
        today={today}
        selectedExerciseId={selectedCell?.workoutId === workoutId ? selectedCell.exerciseId : null}
      />,
    );
    headerSlots.push(<HeaderSlot key={key} workoutId={workoutId} x={NAME_W + index * COL_W} today={today} />);
  }

  useImperativeHandle(
    ref,
    () => ({
      scrollToColumn(workoutId, animated) {
        const el = scrollerRef.current;
        const index = columnIds.indexOf(workoutId);
        if (!el || index < 0) return;
        const dataWidth = el.clientWidth - NAME_W;
        const left = Math.max(0, index * COL_W - (dataWidth - COL_W) / 2);
        el.scrollTo({ left, behavior: animated ? 'smooth' : 'auto' });
      },
      ensureCellVisible(workoutId, exerciseId, bottomInset) {
        const el = scrollerRef.current;
        const column = columnIds.indexOf(workoutId);
        const row = rowIds.indexOf(exerciseId);
        if (!el || column < 0 || row < 0) return;
        // The sticky header and name column cover the first HEADER_H / NAME_W of the viewport.
        const left = revealOffset(column * COL_W, COL_W, el.scrollLeft, el.clientWidth - NAME_W);
        const top = revealOffset(row * ROW_H, ROW_H, el.scrollTop, el.clientHeight - HEADER_H - bottomInset);
        if (left !== el.scrollLeft || top !== el.scrollTop) el.scrollTo({ left, top, behavior: reduced ? 'auto' : 'smooth' });
      },
    }),
    [columnIds, rowIds, reduced],
  );

  // One delegated handler for every cell, header and name.
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>('[data-w][data-e]');
    if (cell) {
      onCellPress(cell.dataset.w as string, cell.dataset.e as string);
      return;
    }
    const header = target.closest<HTMLElement>('[data-h]');
    if (header) {
      onHeaderPress(header.dataset.h as string);
      return;
    }
    const name = target.closest<HTMLElement>('[data-n]');
    if (name) {
      onNamePress(name.dataset.n as string);
      return;
    }
    if (target.closest('[data-add]')) onAddExercise();
  };

  return (
    <div ref={scrollerRef} className={css.scroller} onScroll={onScroll} onClick={onClick} onTouchStart={noop}>
      <div
        className={css.content}
        style={{ width: contentWidth(total), height: contentHeight(rows.length, bottomPad) }}
      >
        <div className={css.headerRow}>
          <div className={css.corner}>{strings.table.corner}</div>
          {headerSlots}
        </div>
        <NameColumn rows={rows} />
        <div className={css.body} style={{ width: total * COL_W + TRAIL_PAD, height: rows.length * ROW_H }}>
          {bodySlots}
        </div>
      </div>
    </div>
  );
}
