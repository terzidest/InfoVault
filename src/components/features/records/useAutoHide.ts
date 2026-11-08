// Reveal-with-countdown state for secret fields: `reveal()` shows the value
// and starts a timer that re-masks it after `ms`; `remainingSeconds` ticks
// down for the "HIDES IN N S" label. The timer is cleared on `hide()` and on
// unmount so a secret is never left revealed by a stale interval.
//
// `createAutoHideTimer` is the React-free core (unit-tested with fake
// timers); the hook only maps its ticks onto state.
import { useCallback, useEffect, useRef, useState } from 'react';
import { countdown } from './recordUi';

/** Tick well under a second so the displayed count never lags the clock. */
export const AUTO_HIDE_TICK_MS = 250;

export interface AutoHideTimer {
  /** (Re)starts the window from `now()`; emits the initial remaining count. */
  start: () => void;
  /** Cancels the interval; no further ticks are emitted. */
  stop: () => void;
}

export const createAutoHideTimer = (
  ms: number,
  onTick: (remainingSeconds: number) => void,
  now: () => number = Date.now
): AutoHideTimer => {
  let handle: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (handle !== null) {
      clearInterval(handle);
      handle = null;
    }
  };

  const start = () => {
    stop();
    const startedAt = now();
    onTick(countdown(startedAt, startedAt, ms));
    handle = setInterval(() => {
      const left = countdown(startedAt, now(), ms);
      if (left === 0) stop();
      onTick(left);
    }, AUTO_HIDE_TICK_MS);
  };

  return { start, stop };
};

export interface AutoHide {
  revealed: boolean;
  remainingSeconds: number;
  reveal: () => void;
  hide: () => void;
}

export const useAutoHide = (ms: number): AutoHide => {
  const [revealed, setRevealed] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timer = useRef<AutoHideTimer | null>(null);

  const hide = useCallback(() => {
    timer.current?.stop();
    timer.current = null;
    setRevealed(false);
    setRemainingSeconds(0);
  }, []);

  const reveal = useCallback(() => {
    timer.current?.stop();
    const next = createAutoHideTimer(ms, (left) => {
      setRemainingSeconds(left);
      if (left === 0) setRevealed(false);
    });
    timer.current = next;
    setRevealed(true);
    next.start();
  }, [ms]);

  // Unmount: never leave an interval running against unmounted state.
  useEffect(() => () => timer.current?.stop(), []);

  return { revealed, remainingSeconds, reveal, hide };
};
