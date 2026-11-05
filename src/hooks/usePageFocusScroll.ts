import { useCallback, useRef } from 'react';
import { scrollTarget, type ScrollExtent } from './focusScroll';

/**
 * Where an element sits within a scroller's content, along one axis, however
 * deeply it is nested: its place on screen, less the scroller's, plus what
 * is already scrolled.
 */
export function scrolledExtent(view: HTMLElement, element: HTMLElement, axis: 'x' | 'y'): ScrollExtent {
  const rect = element.getBoundingClientRect();
  const viewRect = view.getBoundingClientRect();
  return axis === 'y'
    ? { offset: rect.top - viewRect.top + view.scrollTop, length: rect.height }
    : { offset: rect.left - viewRect.left + view.scrollLeft, length: rect.width };
}

/**
 * A vertical page scroller that follows focus. Nothing else moves the page.
 * Rows are measured when revealed, not computed: a wrapped title changes a
 * row's height.
 */
export function usePageFocusScroll(lead = 0): {
  /** The `ScrollView`'s ref. */
  scroller: React.RefObject<HTMLDivElement | null>;
  /** A ref callback for a measured block, keyed. */
  measureRow: (key: string) => (element: HTMLDivElement | null) => void;
  /** Bring a measured block into view, if it is not already. */
  revealRow: (key: string) => void;
} {
  const scroller = useRef<HTMLDivElement | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());

  const measureRow = useCallback(
    (key: string) => (element: HTMLDivElement | null) => {
      if (element) rows.current.set(key, element);
      else rows.current.delete(key);
    },
    [],
  );

  const revealRow = useCallback(
    (key: string) => {
      const row = rows.current.get(key);
      const view = scroller.current;
      if (!row || !view) return;
      const target = scrollTarget(scrolledExtent(view, row, 'y'), view.clientHeight, view.scrollTop, lead);
      if (target === undefined) return;
      view.scrollTop = target;
    },
    [lead],
  );

  return { scroller, measureRow, revealRow };
}
