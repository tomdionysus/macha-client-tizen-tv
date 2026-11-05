/**
 * This client's timing budgets, each with what it is calibrated against.
 * `timingBudgets.test.ts` asserts the relationships between them, not the
 * values. The fragment budgets the Android TV client carries are not here:
 * core holds a source back until the node has produced it (`needsProducedSource`),
 * and its own watchdogs bound what follows.
 */

/**
 * How often a resume point is written during playback: the most progress a
 * killed process may lose. A chosen bound (asserted), calibrated against
 * nothing the server states; the guarded relationship is with the tick below.
 * Do not tie it to core's `SERVER_SESSION_IDLE_MS`: that is the server's
 * default, not what a node states.
 * Spent by core's `progressWriteDue`.
 */
export const CONTINUE_WATCHING_WRITE_INTERVAL_MS = 5 * 60_000;

/**
 * How often the write interval is evaluated, alongside every snapshot. A write
 * lands within one tick of its due time, so this stays well under the interval.
 */
export const CONTINUE_WATCHING_TICK_MS = 30_000;

/**
 * How long a mid-film rebuffer runs before the spinner shows. The web client's
 * `playerSeekSpinnerDelayMs`. Must stay under core's `MEDIA_STALL_TIMEOUT_MS`
 * (7 s) so the spinner is up before a stall is called.
 */
export const REBUFFER_SPINNER_DELAY_MS = 3_000;

/**
 * How long a start runs before the viewer is told it is taking a while. The
 * web client's `playerStartWaitNoticeMs`. Above an ordinary start, below the
 * budget core gives one node's attempt.
 */
export const START_WAIT_NOTICE_MS = 5_000;

/**
 * How long Back from Home waits for queued storage writes
 * (`src/app/appExit.ts`). Storage here is synchronous, so the wait is nil; the
 * bound stays so the exit path reads as the Android client's.
 */
export const EXIT_FLUSH_BUDGET_MS = 2_000;
