import { useRef } from 'react';
import { ScrollView, Text, View, type Style } from './primitives';
import type { MediaSummary } from '@machafoundation/core';
import { firstAvailableIndex } from './availability';
import { MediaCard } from './MediaCard';
import { scrollTarget } from '../hooks/focusScroll';
import { scrolledExtent } from '../hooks/usePageFocusScroll';
import { colour, font, layout, pageGutter, rem, type } from '../styles/theme';

/**
 * A titled horizontal rail, from `.media-section` / `h2` / `.media-row`. It
 * scrolls itself when one of its cards takes focus.
 */
export function MediaRow({
  title,
  items,
  onSelect,
  defaultFocusFirst,
  progressFor,
  onRowFocus,
  addressable,
  onRemove,
  onOpenLink,
  rail,
}: {
  title?: string;
  items: MediaSummary[];
  onSelect: (media: MediaSummary) => void;
  defaultFocusFirst?: boolean;
  progressFor?: (media: MediaSummary) => number | undefined;
  /** A card in this row took focus; for a page scroller following focus. */
  onRowFocus?: () => void;
  /**
   * Give each card its media focus id, so Back returns focus to the card that
   * was opened. Opt-in: ids must be unique on screen.
   */
  addressable?: boolean;
  /** Gives each card a remove button (Continue Watching). */
  onRemove?: (media: MediaSummary) => void;
  /** Gives each episode card its series and season links; see `MediaCard`. */
  onOpenLink?: (target: MediaSummary) => void;
  /** Scope each card's id to this row, where a title can appear in two rows; see `mediaFocusId`. */
  rail?: string;
}): React.JSX.Element | null {
  const scroller = useRef<HTMLDivElement | null>(null);
  const cards = useRef(new Map<number, HTMLDivElement>());

  if (items.length === 0) return null;
  const firstFocus = firstAvailableIndex(items);

  // Scrolls only when the focused card is out of view, from the card's place
  // in the rail; the lead keeps a sliver of the next card visible.
  const revealCard = (index: number) => {
    const card = cards.current.get(index);
    const view = scroller.current;
    if (!card || !view) return;
    const target = scrollTarget(scrolledExtent(view, card, 'x'), view.clientWidth, view.scrollLeft, layout.rowGap);
    if (target === undefined) return;
    view.scrollLeft = target;
  };

  return (
    <View style={styles.section}>
      {title ? <Text style={styles.heading}>{title}</Text> : null}
      <ScrollView ref={scroller} horizontal contentStyle={styles.row}>
        {items.map((media, index) => (
          <View
            key={media.id}
            ref={(element) => {
              if (element) cards.current.set(index, element);
              else cards.current.delete(index);
            }}
            style={index > 0 ? styles.cardAfterFirst : undefined}
          >
            <MediaCard
              media={media}
              onSelect={() => onSelect(media)}
              defaultFocus={defaultFocusFirst && index === firstFocus}
              addressable={addressable}
              rail={rail}
              progress={progressFor?.(media)}
              {...(onRemove ? { onRemove: () => onRemove(media) } : {})}
              onOpenLink={onOpenLink}
              onFocusChange={(focused) => {
                if (!focused) return;
                revealCard(index);
                // The page must scroll vertically to this row too.
                onRowFocus?.();
              }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = {
  // `.media-section { margin-bottom: 2.2rem }`
  section: {
    marginBottom: rem(2.2),
  },
  // `h2 { font-size: clamp(1.2rem,2vw,1.75rem); margin: 1.1rem 0 .75rem; color: #d7d7db }`
  heading: {
    fontSize: type.h2,
    letterSpacing: -type.h2 * 0.01,
    marginTop: rem(1.1),
    marginBottom: rem(0.75),
    marginLeft: pageGutter,
    color: colour.headingDim,
    fontWeight: font.weightMedium,
  },
  // `.media-row { gap: 1rem; padding: .4rem .2rem 1.2rem }`
  row: {
    paddingTop: rem(0.4),
    paddingBottom: rem(1.2),
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
  },
  /** The row's gap, between cards. */
  cardAfterFirst: {
    marginLeft: layout.rowGap,
  },
} satisfies Record<string, Style>;
