/**
 * An action held until OK is released. Raising the IME on OK's key-down hands
 * that press's key-up to the IME, which never saw the key go down; some
 * vendor keyboards crash on it. Any other key pressed first cancels the action.
 */
export class SelectRelease {
  private pending: (() => void) | undefined;

  /** Run `action` when the OK press now in progress is released. */
  hold(action: () => void): void {
    this.pending = action;
  }

  /** A key went down; whatever was held belonged to an earlier press. */
  pressed(): void {
    this.pending = undefined;
  }

  released(): void {
    const action = this.pending;
    this.pending = undefined;
    action?.();
  }
}

export const selectRelease = new SelectRelease();
