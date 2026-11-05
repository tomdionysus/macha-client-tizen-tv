import { describe, expect, it } from 'vitest';
import { backHandler } from './backHandler';

describe('the Return key', () => {
  it('asks the latest listener first, so the player unwinds before the root navigates', () => {
    const asked: string[] = [];
    const root = backHandler.addListener(() => { asked.push('root'); return true; });
    const player = backHandler.addListener(() => { asked.push('player'); return false; });
    expect(backHandler.handle()).toBe(true);
    expect(asked).toEqual(['player', 'root']);
    player.remove();
    root.remove();
  });

  it('stops at the first listener that consumes the press', () => {
    const asked: string[] = [];
    const root = backHandler.addListener(() => { asked.push('root'); return true; });
    const player = backHandler.addListener(() => { asked.push('player'); return true; });
    backHandler.handle();
    expect(asked).toEqual(['player']);
    player.remove();
    root.remove();
  });

  it('answers unconsumed with nobody listening', () => {
    expect(backHandler.handle()).toBe(false);
  });
});
