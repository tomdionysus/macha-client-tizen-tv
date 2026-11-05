/**
 * The library grid's geometry, computed rather than measured: only the rows
 * near the viewport are mounted, so most cards have no view to measure, and a
 * card mounted after a scroll would measure in different window coordinates
 * from one mounted before it. Every card in a library grid has one size, so a
 * card's place follows from its index.
 */

export interface GridMetrics {
  columns: number;
  /** One card's box. */
  cardWidth: number;
  cardHeight: number;
  columnGap: number;
  rowGap: number;
}

/** How many cards fit across `width`, at least one. */
export function columnsFor(width: number, cardWidth: number, columnGap: number): number {
  if (width <= 0 || cardWidth <= 0) return 1;
  return Math.max(1, Math.floor((width + columnGap) / (cardWidth + columnGap)));
}

export function rowCount(itemCount: number, columns: number): number {
  return Math.ceil(itemCount / Math.max(1, columns));
}

/** Distance from one row's top to the next. */
export function rowPitch(metrics: GridMetrics): number {
  return metrics.cardHeight + metrics.rowGap;
}

/** A card's box relative to the grid's top left. */
export function cardBox(index: number, metrics: GridMetrics): { x: number; y: number; width: number; height: number } {
  const row = Math.floor(index / metrics.columns);
  const column = index % metrics.columns;
  return {
    x: column * (metrics.cardWidth + metrics.columnGap),
    y: row * rowPitch(metrics),
    width: metrics.cardWidth,
    height: metrics.cardHeight,
  };
}

export interface RowRange {
  /** First mounted row. */
  first: number;
  /** Last mounted row, inclusive; less than `first` when nothing is. */
  last: number;
}

/**
 * The rows to mount: those the viewport shows when scrolled to `scrollTop`,
 * and `overscan` more each side, so the row a D-pad press moves to already
 * has its cards. `gridTop` is the grid's offset within the scrolled content.
 */
export function mountedRows({
  scrollTop,
  viewportHeight,
  gridTop,
  pitch,
  rows,
  overscan,
}: {
  scrollTop: number;
  viewportHeight: number;
  gridTop: number;
  pitch: number;
  rows: number;
  overscan: number;
}): RowRange {
  if (rows <= 0) return { first: 0, last: -1 };
  if (pitch <= 0) return { first: 0, last: Math.min(rows - 1, overscan) };
  const top = scrollTop - gridTop;
  const visibleFirst = Math.floor(top / pitch);
  const visibleLast = Math.floor((top + Math.max(0, viewportHeight)) / pitch);
  return { first: Math.max(0, visibleFirst - overscan), last: Math.min(rows - 1, visibleLast + overscan) };
}

/** The row holding item `index`. */
export function rowOf(index: number, columns: number): number {
  return Math.floor(index / Math.max(1, columns));
}
