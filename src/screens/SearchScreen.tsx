import { useEffect, useMemo, useRef, useState } from 'react';
import { css, ScrollView, Text, View, type Style } from '../components/primitives';
import {
  DEFAULT_SEARCH_CATEGORIES,
  DEFAULT_SEARCH_SORT,
  isSearchable,
  orderMedia,
  SEARCH_CATEGORIES,
  SEARCH_SORTS,
  type MediaApi,
  type MediaSortKey,
  type SearchCategoryKey,
  type MediaSummary,
  type AlphabetIndexKey,
} from '@machafoundation/core';
import { MediaCard } from '../components/MediaCard';
import { TvTextInput } from '../components/TvTextInput';
import { SortControl } from '../components/SortControl';
import { CategoryToggles } from '../components/CategoryToggles';
import { Focusable } from '../components/Focusable';
import { RefreshIcon } from '../components/NavIcons';
import { AlphabetIndex, alphabetStripWidth } from '../components/AlphabetIndex';
import { availableToPlay } from '@machafoundation/core';
import { isMediaFocusId, useAlphabetIndex } from '../hooks/useAlphabetIndex';
import { ErrorMessage, Loading, PageTitle } from '../components/Status';
import { jumpTarget, scrollTarget } from '../hooks/focusScroll';
import { scrolledExtent } from '../hooks/usePageFocusScroll';
import { tvFocus } from '../hooks/tvFocus';
import { CARD_FRAME, colour, controlRow, focusFrame, layout, pageGutter, px, rem } from '../styles/theme';

/**
 * Search, with the web client's query rules: nothing is asked below core's
 * minimum, and results clear rather than stand under a half-typed query.
 * `TvTextInput` raises the set's keyboard, and the focus registry stands down
 * (`tvFocus.suspend()`) while it owns the D-pad.
 */
export function SearchScreen({
  api,
  onOpen,
}: {
  api: MediaApi;
  onOpen: (media: MediaSummary) => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [sort, setSort] = useState<MediaSortKey>(DEFAULT_SEARCH_SORT);
  const [categories, setCategories] = useState<SearchCategoryKey[]>([...DEFAULT_SEARCH_CATEGORIES]);
  // Core's search names every hit: an episode with its series, a track as
  // "Artist - Album (year)".
  const ordered = useMemo(() => orderMedia(results, sort, SEARCH_SORTS), [results, sort]);
  // Asks the same question again (`.search-bar-refresh`).
  const [refreshToken, setRefreshToken] = useState(0);
  // The A-Z index only in title order, where a letter marks a run of the grid.
  const indexed = sort === 'title';
  // A letter leads only to titles that can take focus.
  const alphabet = useAlphabetIndex(useMemo(() => (indexed ? ordered.filter(availableToPlay) : []), [indexed, ordered]));

  const scroller = useRef<HTMLDivElement | null>(null);
  const cards = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const normalised = query.trim();
    // Core's rule: "the", "an" and "a" do not count towards the minimum.
    if (!isSearchable(normalised)) {
      setResults([]);
      setError(undefined);
      setSearching(false);
      return undefined;
    }
    let active = true;
    setSearching(true);
    setError(undefined);
    const timer = setTimeout(() => {
      void api
        .search(normalised, undefined, { categories })
        .then((value) => {
          if (active) setResults(value);
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason : new Error(String(reason)));
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, SETTLE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, query, categories, refreshToken]);

  // The search bar sits above the results and scrolls away with them: when
  // focus leaves the results and the strip for anything else (the bar, Up from
  // the first row), bring the page back to its top so the focus is seen.
  useEffect(() => {
    const unsubscribe = tvFocus.subscribe((id) => {
      if (id === undefined || id.startsWith('alphabet:') || isMediaFocusId(id)) return;
      const view = scroller.current;
      if (view) view.scrollTop = 0;
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const scrollPage = (target: number) => {
    const view = scroller.current;
    if (view) view.scrollTop = target;
  };

  /** Focus the letter's first title and put its row at the top (`jumpTarget`). */
  const jumpToKey = (key: AlphabetIndexKey) => {
    const mediaId = alphabet.jumpTo(key);
    const card = mediaId === undefined ? undefined : cards.current.get(mediaId);
    const view = scroller.current;
    if (!card || !view) return;
    scrollPage(jumpTarget(scrolledExtent(view, card, 'y'), rem(1.4), Math.max(0, view.scrollHeight - view.clientHeight)));
  };

  /** Bring a focused card fully into view. */
  const revealCard = (mediaId: string) => {
    const card = cards.current.get(mediaId);
    const view = scroller.current;
    if (!card || !view) return;
    const target = scrollTarget(scrolledExtent(view, card, 'y'), view.clientHeight, view.scrollTop, rem(1.4));
    if (target !== undefined) scrollPage(target);
  };

  return (
    <View style={styles.screen}>
      <ScrollView ref={scroller} contentStyle={styles.page}>
        <PageTitle>Search</PageTitle>

        {/*
          * `.search-bar { --search-control-height: 3.5rem; display: flex; gap: 1rem;
          * width: 100% }`: field, sort, type toggles, refresh (`controlRow`).
          */}
        <View style={styles.bar}>
          <TvTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your library"
            defaultFocus
            fieldStyle={styles.field}
            boxStyle={styles.fieldBox}
            boxFocusedStyle={styles.fieldBoxFocused}
            inputStyle={styles.fieldInput}
          />
          <SortControl sorts={SEARCH_SORTS} value={sort} onChange={setSort} height={controlRow.height} style={styles.barItem} />
          <View style={styles.barItem}>
            <CategoryToggles
              categories={TV_SEARCH_CATEGORIES}
              selected={categories}
              onChange={setCategories}
              height={controlRow.height}
            />
          </View>
          <Focusable
            ring={false}
            onSelect={() => setRefreshToken((value) => value + 1)}
            style={css(styles.refresh, styles.barItem)}
            focusedStyle={styles.refreshFocused}
          >
            {({ focused }) => <RefreshIcon size={px(22)} colour={focused ? colour.heading : colour.textDim} />}
          </Focusable>
        </View>

        {error ? <ErrorMessage error={error} /> : null}

        {query.trim().length === 0 ? null : searching && results.length === 0 ? (
          <Loading />
        ) : !isSearchable(query) || categories.length === 0 || results.length === 0 ? (
          // `.search-empty`: one line for every way a query comes back empty.
          <Text style={styles.empty}>Nothing found. Try different search terms or filters.</Text>
        ) : (
          <View style={css(styles.grid, indexed && styles.gridIndexed)}>
            {ordered.map((item) => (
              <View
                key={item.id}
                ref={(element) => {
                  if (element) cards.current.set(item.id, element);
                  else cards.current.delete(item.id);
                }}
                style={styles.cell}
              >
                <MediaCard
                  media={item}
                  addressable
                  squareInPosterHeight
                  onSelect={() => onOpen(item)}
                  onOpenLink={onOpen}
                  onFocusChange={(focused) => focused && revealCard(item.id)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      {indexed && ordered.length > 0 ? (
        <AlphabetIndex availableKeys={alphabet.availableKeys} onSelect={jumpToKey} />
      ) : null}
    </View>
  );
}

/** What Search offers: core's defaults, which leave out books. Books are not on the television (Tom, 2026-11-05). */
export const TV_SEARCH_CATEGORIES = SEARCH_CATEGORIES.filter((category) => DEFAULT_SEARCH_CATEGORIES.includes(category.key));

/** Settle before the node is asked. Asserted: the web client's figure, kept identical. */
const SETTLE_MS = 180;

// `.media-grid { gap: 1.4rem 1rem }`, with `.search-results { row-gap: 1rem }`, less each card's focus frame.
const rowGap = Math.max(rem(0.4), rem(1) - CARD_FRAME * 2);
const columnGap = layout.rowGap;

const styles = {
  screen: {
    flex: 1,
  },
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: controlRow.height,
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    marginBottom: rem(1.4),
  },
  /** The bar's `gap: 1rem`. */
  barItem: {
    marginLeft: rem(1),
  },
  // `.search-input { flex: 1; min-width: 0 }`
  field: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  /**
   * `.search-input { background: #19191c; border: 1px solid #3a3a40;
   * border-radius: .65rem; font-size: 1.15rem }`, with `focusFrame.border`.
   */
  fieldBox: {
    height: controlRow.height,
    justifyContent: 'center',
    borderRadius: controlRow.radius,
    backgroundColor: colour.inputBackground,
    borderWidth: focusFrame.border,
    borderColor: colour.inputBorder,
  },
  fieldBoxFocused: {
    borderColor: colour.focus,
  },
  fieldInput: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: rem(1.2),
    paddingRight: rem(1.2),
    fontSize: rem(1.15),
    minWidth: 0,
  },
  // `.search-bar-refresh { width/height: var(--search-control-height); border-radius: .65rem }`
  refresh: {
    width: controlRow.height,
    height: controlRow.height,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: controlRow.radius,
    backgroundColor: colour.inputBackground,
    borderWidth: focusFrame.border,
    borderStyle: 'solid',
    borderColor: colour.inputBorder,
  },
  refreshFocused: {
    borderColor: colour.focus,
  },
  // `.search-empty { place-items: center; color: var(--text-dim); font-size: 1.1rem }`
  empty: {
    marginTop: rem(4),
    textAlign: 'center',
    color: colour.textDim,
    fontSize: rem(1.1),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: pageGutter,
    // Each cell carries the column gap on its right, so the last column's is taken off the gutter.
    paddingRight: pageGutter - columnGap,
    // Top-aligned, so a longer caption cannot push the other titles down.
    alignItems: 'flex-start',
  },
  // The strip is pinned over this edge when it is showing.
  gridIndexed: {
    paddingRight: pageGutter + alphabetStripWidth - columnGap,
  },
  cell: {
    marginRight: columnGap,
    marginBottom: rowGap,
  },
} satisfies Record<string, Style>;
