import { useMemo, useRef } from 'react';
import { ScrollView, View, type Style } from '../components/primitives';
import { sortMediaByIndexedTitle, type MediaApi, type MediaSummary } from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { firstAvailableIndex } from '../components/availability';
import { MediaCard } from '../components/MediaCard';
import { scrollTarget } from '../hooks/focusScroll';
import { scrolledExtent } from '../hooks/usePageFocusScroll';
import { CARD_FRAME, layout, pageGutter, rem } from '../styles/theme';

/**
 * Music: albums only, one of the web client's seven music routes. Playing an
 * album in order, queueing and artists need the queue and the `OverflowMenu`,
 * which the television clients do not have.
 */
export function MusicScreen({
  api,
  onOpen,
}: {
  api: MediaApi;
  onOpen: (media: MediaSummary) => void;
}): React.JSX.Element {
  const result = useRefreshableAsync(() => api.albums(), [api]);
  const items = useMemo(() => sortMediaByIndexedTitle(result.value ?? []), [result.value]);
  const firstFocus = firstAvailableIndex(items);

  const scroller = useRef<HTMLDivElement | null>(null);
  const cards = useRef(new Map<number, HTMLDivElement>());

  const revealCard = (index: number) => {
    const card = cards.current.get(index);
    const view = scroller.current;
    if (!card || !view) return;
    const target = scrollTarget(scrolledExtent(view, card, 'y'), view.clientHeight, view.scrollTop, rem(1.4));
    if (target === undefined) return;
    view.scrollTop = target;
  };

  if (!result.value) {
    return (
      <ScrollView contentStyle={styles.page}>
        <PageTitle>Music</PageTitle>
        {result.loading ? <Loading /> : result.error ? <ErrorMessage error={result.error} /> : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scroller} contentStyle={styles.page}>
      <PageTitle>Music</PageTitle>
      {result.error ? <RefreshError error={result.error} /> : null}
      <View style={styles.grid}>
        {items.map((item, index) => (
          <View
            key={item.id}
            ref={(element) => {
              if (element) cards.current.set(index, element);
              else cards.current.delete(index);
            }}
            style={styles.cell}
          >
            <MediaCard
              media={item}
              onSelect={() => onOpen(item)}
              defaultFocus={index === firstFocus}
              onFocusChange={(focused) => focused && revealCard(index)}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// `.media-grid { gap: 1.4rem 1rem }`, less each card's focus frame. See `layout.rowGap`.
const rowGap = Math.max(rem(0.5), rem(1.4) - CARD_FRAME * 2);
const columnGap = layout.rowGap;

const styles = {
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: pageGutter,
    // Each cell carries the column gap on its right, so the last column's is taken off the gutter.
    paddingRight: pageGutter - columnGap,
  },
  cell: {
    marginRight: columnGap,
    marginBottom: rowGap,
  },
} satisfies Record<string, Style>;
