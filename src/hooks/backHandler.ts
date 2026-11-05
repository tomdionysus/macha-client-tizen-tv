/**
 * The remote's Return key, dispatched as React Native's `BackHandler` does:
 * listeners in reverse order of registration, the first to answer `true`
 * consumes the press. The player screen registers after the application root,
 * so its layers (options panel, chrome) unwind before the root's navigation.
 */
type BackListener = () => boolean;

const listeners: BackListener[] = [];

export const backHandler = {
  addListener(listener: BackListener): { remove(): void } {
    listeners.push(listener);
    return {
      remove() {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      },
    };
  },

  /** True when a listener consumed the press. */
  handle(): boolean {
    for (let index = listeners.length - 1; index >= 0; index -= 1) {
      if (listeners[index]!()) return true;
    }
    return false;
  },
};
