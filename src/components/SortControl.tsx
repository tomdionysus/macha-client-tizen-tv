import { css, Text, type Style } from './primitives';
import type { MediaSort, MediaSortKey } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { colour, controlRow, focusFrame, rem, type } from '../styles/theme';
import { sortChoiceLabel } from '../text/viewerText';

/**
 * The sort choice as one control: each press steps to the next of core's
 * sorts (`SEARCH_SORTS`, `LIBRARY_SORTS`), wrapping. It stands in for the web
 * client's `<select>`, which has no D-pad form.
 */
export function SortControl({
  sorts,
  value,
  onChange,
  height,
  style,
}: {
  /** The row's height, when it sits in a row of equal controls (Search). */
  height?: number;
  sorts: readonly MediaSort[];
  value: MediaSortKey;
  onChange: (key: MediaSortKey) => void;
  /** Placement only. */
  style?: Style;
}): React.JSX.Element | null {
  if (sorts.length === 0) return null;
  const index = Math.max(0, sorts.findIndex((sort) => sort.key === value));
  const current = sorts[index]!;
  return (
    <Focusable
      ring={false}
      onSelect={() => onChange(sorts[(index + 1) % sorts.length]!.key)}
      style={css(styles.control, height !== undefined && { height, paddingTop: 0, paddingBottom: 0 }, style)}
      focusedStyle={styles.controlFocused}
    >
      {({ focused }) => (
        <Text style={css(styles.label, focused && styles.labelFocused)} numberOfLines={1}>
          {sortChoiceLabel(current.key)}
        </Text>
      )}
    </Focusable>
  );
}

const styles = {
  /**
   * `.search-bar .sort-control select { padding: 1rem 1.2rem; border-radius:
   * .65rem; font-size: 1.05rem }` over `.sort-control select { background:
   * #19191c; color: #d7d7da }`, with `focusFrame.border` for its 1px.
   */
  control: {
    paddingLeft: rem(1.2),
    paddingRight: rem(1.2),
    paddingTop: rem(0.8),
    paddingBottom: rem(0.8),
    borderRadius: controlRow.radius,
    justifyContent: 'center',
    borderWidth: focusFrame.border,
    borderStyle: 'solid',
    borderColor: colour.inputBorder,
    backgroundColor: colour.inputBackground,
  },
  controlFocused: {
    borderColor: colour.focus,
    backgroundColor: colour.accentSurfaceStrong,
  },
  label: {
    color: colour.optionText,
    fontSize: type.body,
  },
  labelFocused: {
    color: colour.heading,
  },
} satisfies Record<string, Style>;
