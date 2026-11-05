import { describe, expect, it } from 'vitest';
import { cardBox, columnsFor, mountedRows, rowCount, type GridMetrics } from './gridWindow';

const metrics: GridMetrics = { columns: 7, cardWidth: 150, cardHeight: 280, columnGap: 10, rowGap: 20 };

describe('columnsFor', () => {
  it('fits as many cards and gaps as the width holds', () => {
    // 7 cards and 6 gaps: 1110.
    expect(columnsFor(1110, 150, 10)).toBe(7);
    expect(columnsFor(1109, 150, 10)).toBe(6);
  });

  it('is at least one before the width is known', () => {
    expect(columnsFor(0, 150, 10)).toBe(1);
    expect(columnsFor(100, 150, 10)).toBe(1);
  });
});

describe('rowCount', () => {
  it('counts a part row', () => {
    expect(rowCount(15, 7)).toBe(3);
    expect(rowCount(14, 7)).toBe(2);
    expect(rowCount(0, 7)).toBe(0);
  });
});

describe('cardBox', () => {
  it('places a card by its row and column', () => {
    expect(cardBox(0, metrics)).toEqual({ x: 0, y: 0, width: 150, height: 280 });
    expect(cardBox(9, metrics)).toEqual({ x: 320, y: 300, width: 150, height: 280 });
  });
});

describe('mountedRows', () => {
  const base = { viewportHeight: 600, gridTop: 100, pitch: 300, rows: 60, overscan: 2 };

  it('mounts the visible rows and the overscan, clamped to the grid', () => {
    // At the top the viewport shows rows 0 to 1 (content 0 to 600, grid from 100).
    expect(mountedRows({ ...base, scrollTop: 0 })).toEqual({ first: 0, last: 3 });
  });

  it('follows the scroll', () => {
    // Content 3100 to 3700 is grid 3000 to 3600: rows 10 to 12.
    expect(mountedRows({ ...base, scrollTop: 3100 })).toEqual({ first: 8, last: 14 });
  });

  it('stops at the last row', () => {
    expect(mountedRows({ ...base, scrollTop: 17_600 })).toEqual({ first: 56, last: 59 });
  });

  it('mounts nothing for an empty grid', () => {
    expect(mountedRows({ ...base, rows: 0, scrollTop: 0 })).toEqual({ first: 0, last: -1 });
  });
});
