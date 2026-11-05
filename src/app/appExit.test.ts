import { describe, expect, it, vi } from 'vitest';
import { exitAfterFlush } from './appExit';

describe('leaving the app from Home', () => {
  it('leaves only once every queued write has reached the device', async () => {
    let finish!: () => void;
    const flush = () => new Promise<void>((resolve) => { finish = resolve; });
    const exit = vi.fn();
    const leaving = exitAfterFlush(flush, exit, 60_000);
    await Promise.resolve();
    expect(exit).not.toHaveBeenCalled();
    finish();
    await leaving;
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('still leaves when a write never finishes, after the budget', async () => {
    vi.useFakeTimers();
    try {
      const exit = vi.fn();
      const leaving = exitAfterFlush(() => new Promise(() => undefined), exit, 2_000);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(exit).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await leaving;
      expect(exit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves once however many times Back is pressed while it waits', async () => {
    let finish!: () => void;
    const flush = () => new Promise<void>((resolve) => { finish = resolve; });
    const exit = vi.fn();
    const first = exitAfterFlush(flush, exit, 60_000);
    const second = exitAfterFlush(flush, exit, 60_000);
    finish();
    await Promise.all([first, second]);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
