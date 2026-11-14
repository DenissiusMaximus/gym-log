export type FpsStats = {
  /** Longest frame in the window, ms. */
  worst: number;
  /** Frames longer than 24 ms in the window. */
  slow: number;
  frames: number;
};

const WINDOW_MS = 5000;
const SLOW_MS = 24;

/** Counts frames via requestAnimationFrame. Returns a stop function and a stats reader. */
export function startFpsMeter(): { stop: () => void; read: () => FpsStats } {
  let frames: { at: number; duration: number }[] = [];
  let last = 0;
  let handle = 0;
  let running = true;

  const tick = (time: number) => {
    if (!running) return;
    if (last) frames.push({ at: time, duration: time - last });
    last = time;
    const cutoff = time - WINDOW_MS;
    if (frames.length && frames[0].at < cutoff) frames = frames.filter((f) => f.at >= cutoff);
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(handle);
    },
    read() {
      return {
        worst: frames.reduce((max, f) => Math.max(max, f.duration), 0),
        slow: frames.filter((f) => f.duration > SLOW_MS).length,
        frames: frames.length,
      };
    },
  };
}
