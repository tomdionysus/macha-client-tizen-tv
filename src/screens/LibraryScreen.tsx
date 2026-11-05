import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { css, ScrollView, View, type Style } from '../components/primitives';
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORTS,
  orderMedia,
  type MediaApi,
  type MediaSortKey,
  type MediaSummary,
  type AlphabetIndexKey,
} from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaCard } from '../components/MediaCard';
import { AlphabetIndex, alphabetStripWidth } from '../components/AlphabetIndex';
import { SortControl } from '../components/SortControl';
import { firstAvailableIndex } from '../components/availability';
import { availableToPlay } from '@machafoundation/core';
import { mediaFocusId, useAlphabetIndex } from '../hooks/useAlphabetIndex';
import { jumpTarget, scrollTarget } from '../hooks/focusScroll';
import { tvFocus } from '../hooks/tvFocus';
import { CARD_FRAME, layout, pageGutter, rem } from '../styles/theme';
import {
  cardBox,
  columnsFor,
  mountedRows,
  rowCount,
  rowPitch,
  type GridMetrics,
} from './library/gridWindow';

/**
 * The catalogue grid, from `.media-grid` in base.css: rows of as many cards as
 * the width holds. Only the rows near the viewport have cards; the rest are
 * empty boxes of a row's height, so a large library does not mount, decode
 * and draw every poster (see `gridWindow`). Ordering is core's
 * (`LIBRARY_SORTS`, `orderMedia`). The alphabet index shows only in title
 * order, where a letter names a run of the grid.
 */
export function LibraryScreen({
  api,
  kind,
  onOpen,
}: {
  api: MediaApi;
  kind: 'movies' | 'shows';
  onOpen: (media: MediaSummary) => void;
}): React.JSX.Element {
  const result = useRefreshableAsync(
    () => (kind === 'movies' ? api.movies() : api.shows()),
    [api, kind],
  );
  const [sort, setSort] = useState<MediaSortKey>(DEFAULT_LIBRARY_SORT);
  const items = useMemo(() => orderMedia(result.value ?? [], sort, LIBRARY_SORTS), [result.value, sort]);
  const firstFocus = firstAvailableIndex(items);
  const indexed = sort === 'title';
  const scroller = useRef<HTMLDivElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  /** The scroller's box; it does not scroll. */
  const [viewport, setViewport] = useState<{ width: number; height: number }>();
  /** The grid's offset within the scrolled content. */
  const [gridY, setGridY] = useState(0);
  /** Where the page is scrolled to, which decides the rows mounted. */
  const [scrollTop, setScrollTop] = useState(0);
  /** A card's height as laid out, the tallest seen; the estimate stands in until one is. */
  const [measuredCardHeight, setMeasuredCardHeight] = useState<number>();
  // A jump moves focus and scroll-on-focus reveals it (see `useAlphabetIndex`).
  // A letter leads only to titles that can take focus.
  const alphabet = useAlphabetIndex(useMemo(() => items.filter(availableToPlay), [items]));

  // The geometry settles once the list is up; a television does not resize.
  useLayoutEffect(() => {
    const view = scroller.current;
    if (view) setViewport({ width: view.clientWidth, height: view.clientHeight });
    if (grid.current) setGridY(grid.current.offsetTop);
  }, [result.value]);

  const cardWidth = layout.mediaCardWidth;
  const metrics: GridMetrics = {
    columns: columnsFor((viewport?.width ?? 0) - gridPaddingLeft - gridPaddingRight, cardWidth, columnGap),
    cardWidth,
    cardHeight: measuredCardHeight ?? cardWidth * 1.5 + rem(3),
    columnGap,
    rowGap,
  };
  const rows = rowCount(items.length, metrics.columns);
  const mounted = mountedRows({
    scrollTop,
    viewportHeight: viewport?.height ?? 0,
    gridTop: gridY,
    pitch: rowPitch(metrics),
    rows,
    overscan: OVERSCAN_ROWS,
  });

  /** Scroll so the card at `index` is fully in view; its row mounts if it was not. */
  const scrollToCard = (index: number, place: 'reveal' | 'top') => {
    const view = scroller.current;
    if (!viewport || !view || index < 0) return;
    const box = cardBox(index, metrics);
    const extent = { offset: gridY + box.y, length: box.height };
    const target =
      place === 'top'
        ? jumpTarget(extent, rem(1.4), Math.max(0, view.scrollHeight - viewport.height))
        : scrollTarget(extent, viewport.height, view.scrollTop, rem(1.4));
    if (target === undefined || target === view.scrollTop) return;
    view.scrollTop = target;
    setScrollTop(target);
  };

  // Back returns to a card that may be far down the grid and not mounted:
  // scroll to it, and it claims focus when it registers.
  const restoreId = tvFocus.pendingRestore() ?? tvFocus.selected();
  const restoreIndex = items.findIndex((entry) => mediaFocusId(entry.id) === restoreId);
  useEffect(() => {
    if (restoreIndex >= 0) scrollToCard(restoreIndex, 'reveal');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the grid's geometry settles.
  }, [restoreIndex, viewport, gridY, metrics.columns, metrics.cardHeight]);

  const title = kind === 'movies' ? 'Movies' : 'TV Shows';
  if (!result.value) {
    return (
      <ScrollView contentStyle={styles.page}>
        <PageTitle>{title}</PageTitle>
        {result.loading ? <Loading /> : result.error ? <ErrorMessage error={result.error} /> : null}
      </ScrollView>
    );
  }

  /** Focus the letter's first title and put its row at the top (`jumpTarget`). */
  const jumpToKey = (key: AlphabetIndexKey) => {
    const mediaId = alphabet.jumpTo(key);
    scrollToCard(mediaId === undefined ? -1 : items.findIndex((entry) => entry.id === mediaId), 'top');
  };

  /** A mounted card's height, the tallest seen. */
  const measureCard = (element: HTMLDivElement | null) => {
    if (!element) return;
    const height = element.offsetHeight;
    if (height > 0 && height > (measuredCardHeight ?? 0)) setMeasuredCardHeight(height);
  };

  const renderRow = (row: number) => {
    const style = css(styles.row, row > 0 && styles.rowAfterFirst, { height: metrics.cardHeight });
    if (!viewport || row < mounted.first || row > mounted.last) return <View key={row} style={style} />;
    const from = row * metrics.columns;
    return (
      <View key={row} style={style}>
        {items.slice(from, from + metrics.columns).map((item, offset) => {
          const index = from + offset;
          return (
            <View key={item.id} ref={measureCard} style={offset > 0 ? styles.cardAfterFirst : undefined}>
              <MediaCard
                media={item}
                addressable
                onSelect={() => onOpen(item)}
                defaultFocus={index === firstFocus}
                onFocusChange={(focused) => focused && scrollToCard(index, 'reveal')}
              />
            </View>
          );
        })}
      </View>
    );
  };

  return (
    // The strip is a sibling of the scroller, so it stays pinned to the screen edge.
    <View style={styles.screen}>
      <ScrollView ref={scroller} contentStyle={styles.page}>
        {/* `.media-page-title-row { display: flex; align-items: center; justify-content: space-between }` */}
        <View style={styles.titleRow}>
          <PageTitle>{title}</PageTitle>
          <SortControl sorts={LIBRARY_SORTS} value={sort} onChange={setSort} />
        </View>
        {result.error ? <RefreshError error={result.error} /> : null}
        <View ref={grid} style={styles.grid}>
          {Array.from({ length: rows }, (_, row) => renderRow(row))}
        </View>
      </ScrollView>
      {indexed ? <AlphabetIndex availableKeys={alphabet.availableKeys} onSelect={jumpToKey} /> : null}
    </View>
  );
}

/**
 * Rows mounted beyond each edge of the viewport. The row a D-pad press moves
 * to must already have its cards: focus can only land on a registered card.
 */
const OVERSCAN_ROWS = 2;
// `.media-grid { gap: 1.4rem 1rem }`, less each card's focus frame. See `layout.rowGap`.
const rowGap = Math.max(rem(0.5), rem(1.4) - CARD_FRAME * 2);
const columnGap = layout.rowGap;
const gridPaddingLeft = pageGutter;
// Keeps clear of the alphabet strip pinned over this edge.
const gridPaddingRight = pageGutter + alphabetStripWidth;

const styles = {
  screen: {
    flex: 1,
  },
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: pageGutter + alphabetStripWidth,
  },
  grid: {
    paddingLeft: gridPaddingLeft,
    paddingRight: gridPaddingRight,
  },
  /** One row of cards, or the empty box standing in for an unmounted one. */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowAfterFirst: {
    marginTop: rowGap,
  },
  cardAfterFirst: {
    marginLeft: columnGap,
  },
} satisfies Record<string, Style>;
