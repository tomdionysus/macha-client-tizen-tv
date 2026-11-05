import type { StorageLike } from '@machafoundation/core';

/**
 * Web Storage behind core's `StorageLike`. The set's `localStorage` is
 * synchronous and survives a relaunch, so there is nothing to hydrate or
 * flush; `hydrateStorage` and `flushStorage` keep the Android TV client's
 * shape, where AsyncStorage needs both, so `App.tsx` and `endpointChange.ts`
 * read the same there and here.
 */

function backing(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    // Access can throw where storage is disabled; that reads as empty.
    return undefined;
  }
}

export const nativeStorage: StorageLike = {
  getItem: (key) => {
    try {
      return backing()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      backing()?.setItem(key, value);
    } catch {
      // A full or disabled store loses the write; the next launch starts from what it has.
    }
  },
  removeItem: (key) => {
    try {
      backing()?.removeItem(key);
    } catch {
      // As above.
    }
  },
};

/** Nothing to load: every read goes to the store. Kept so startup reads as the Android client's. */
export function hydrateStorage(): Promise<void> {
  return Promise.resolve();
}

/** Every write has already landed. For app exit and the endpoint change. */
export function flushStorage(): Promise<unknown> {
  return Promise.resolve();
}
