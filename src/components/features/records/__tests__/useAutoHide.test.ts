// The hook itself needs a renderer; its timer core is tested here with fake
// timers (modern fake timers also drive Date.now).
import { AUTO_HIDE_TICK_MS, createAutoHideTimer } from '../useAutoHide';

describe('createAutoHideTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits the full count immediately, then one less each second', () => {
    const ticks: number[] = [];
    const timer = createAutoHideTimer(10_000, (left) => ticks.push(left));
    timer.start();
    expect(ticks).toEqual([10]);

    jest.advanceTimersByTime(1_000);
    expect(ticks[ticks.length - 1]).toBe(9);

    jest.advanceTimersByTime(4_000);
    expect(ticks[ticks.length - 1]).toBe(5);
    timer.stop();
  });

  it('reaches zero exactly once and then stops ticking', () => {
    const ticks: number[] = [];
    const timer = createAutoHideTimer(3_000, (left) => ticks.push(left));
    timer.start();
    jest.advanceTimersByTime(3_000 + AUTO_HIDE_TICK_MS);
    expect(ticks[ticks.length - 1]).toBe(0);
    expect(ticks.filter((t) => t === 0)).toHaveLength(1);

    const count = ticks.length;
    jest.advanceTimersByTime(5_000);
    expect(ticks).toHaveLength(count);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stop() cancels pending ticks', () => {
    const ticks: number[] = [];
    const timer = createAutoHideTimer(10_000, (left) => ticks.push(left));
    timer.start();
    timer.stop();
    jest.advanceTimersByTime(20_000);
    expect(ticks).toEqual([10]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('start() again restarts the window from now', () => {
    const ticks: number[] = [];
    const timer = createAutoHideTimer(10_000, (left) => ticks.push(left));
    timer.start();
    jest.advanceTimersByTime(6_000);
    expect(ticks[ticks.length - 1]).toBe(4);

    timer.start();
    expect(ticks[ticks.length - 1]).toBe(10);
    jest.advanceTimersByTime(1_000);
    expect(ticks[ticks.length - 1]).toBe(9);
    // Only one interval alive after the restart.
    expect(jest.getTimerCount()).toBe(1);
    timer.stop();
  });
});
