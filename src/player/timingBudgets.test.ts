import { describe, expect, it } from 'vitest';
import timingBudgetsSource from './timingBudgets.ts?raw';
import { generationAttemptBudgetMs, MEDIA_STALL_TIMEOUT_MS } from '@machafoundation/core';
import {
  CONTINUE_WATCHING_TICK_MS,
  CONTINUE_WATCHING_WRITE_INTERVAL_MS,
  REBUFFER_SPINNER_DELAY_MS,
  START_WAIT_NOTICE_MS,
} from './timingBudgets';

/** Both figures are choices; these pin what a careless change would break. */
describe('the resume-point cadence', () => {
  it('is not tied to anything the server states', () => {
    // The server's session idle figure is a default a node may override
    // (`macha-ts` `src/playback/streamProtocol.ts`), so the interval must be
    // arithmetic on literals. Asserted on the declaration, because the
    // docblock names the server constant.
    const declaration = /export const CONTINUE_WATCHING_WRITE_INTERVAL_MS = ([^;]+);/
      .exec(timingBudgetsSource)?.[1];
    expect(declaration).toBeDefined();
    expect(declaration).toMatch(/^[\d_\s*+]+$/);
  });

  it('evaluates the interval far more often than the interval itself', () => {
    // A write lands within one tick of being due, so the tick stays well under the interval.
    expect(CONTINUE_WATCHING_TICK_MS).toBeLessThan(CONTINUE_WATCHING_WRITE_INTERVAL_MS);
    expect(CONTINUE_WATCHING_WRITE_INTERVAL_MS / CONTINUE_WATCHING_TICK_MS).toBeGreaterThanOrEqual(4);
  });

  it('does not tick faster than the stall watchdog it shares a device with', () => {
    // A cost coupling: this timer runs for the whole of every film, on a set
    // that is slow to begin with.
    expect(CONTINUE_WATCHING_TICK_MS).toBeGreaterThanOrEqual(MEDIA_STALL_TIMEOUT_MS);
  });
});

describe('what the viewer is shown while waiting', () => {
  it('raises the rebuffer spinner before a stall is called', () => {
    expect(REBUFFER_SPINNER_DELAY_MS).toBeLessThan(MEDIA_STALL_TIMEOUT_MS);
  });

  it("tells the viewer a start is slow before one node's attempt runs out", () => {
    expect(START_WAIT_NOTICE_MS).toBeLessThan(generationAttemptBudgetMs());
  });
});
