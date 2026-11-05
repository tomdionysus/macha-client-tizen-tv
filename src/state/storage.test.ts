import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeStorage } from './storage';

function fakeLocalStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('web storage behind core', () => {
  it('reads back what it wrote, and absent as null', () => {
    vi.stubGlobal('window', { localStorage: fakeLocalStorage() });
    expect(nativeStorage.getItem('macha-client-id')).toBeNull();
    nativeStorage.setItem('macha-client-id', 'set-1');
    expect(nativeStorage.getItem('macha-client-id')).toBe('set-1');
    nativeStorage.removeItem('macha-client-id');
    expect(nativeStorage.getItem('macha-client-id')).toBeNull();
  });

  it('reads as empty, and never throws, where the store is disabled', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('SecurityError');
      },
    });
    expect(nativeStorage.getItem('macha-client-id')).toBeNull();
    expect(() => nativeStorage.setItem('macha-client-id', 'set-1')).not.toThrow();
    expect(() => nativeStorage.removeItem('macha-client-id')).not.toThrow();
  });

  it('reads as empty with no window at all', () => {
    vi.stubGlobal('window', undefined);
    expect(nativeStorage.getItem('macha-client-id')).toBeNull();
  });
});
