import { describe, expect, it } from 'vitest';
import { SelectRelease } from './selectRelease';

describe('SelectRelease', () => {
  it('runs nothing until OK is released', () => {
    const release = new SelectRelease();
    let ran = 0;
    release.hold(() => ran++);
    expect(ran).toBe(0);
    release.released();
    expect(ran).toBe(1);
  });

  it('runs a held action once only', () => {
    const release = new SelectRelease();
    let ran = 0;
    release.hold(() => ran++);
    release.released();
    release.released();
    expect(ran).toBe(1);
  });

  it('drops the action when another key goes down first', () => {
    const release = new SelectRelease();
    let ran = 0;
    release.hold(() => ran++);
    release.pressed();
    release.released();
    expect(ran).toBe(0);
  });

  it('keeps the action held by the press that is going down', () => {
    const release = new SelectRelease();
    let ran = 0;
    release.pressed();
    release.hold(() => ran++);
    release.released();
    expect(ran).toBe(1);
  });
});
