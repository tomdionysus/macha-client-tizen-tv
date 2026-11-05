import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { css, type Style } from './primitives';
import { useFocusable } from '../hooks/useTvNavigation';
import type { TvDirection } from '../hooks/tvFocus';
import { colour, radius } from '../styles/theme';

export interface FocusableProps {
  /** A stable id, for moving focus here by name. See `useFocusable`. */
  focusId?: string;
  children: ReactNode | ((state: { focused: boolean }) => ReactNode);
  onSelect?: () => void;
  disabled?: boolean;
  defaultFocus?: boolean;
  scope?: string;
  style?: Style;
  /** Style applied only while focused, on top of `style`. */
  focusedStyle?: Style;
  /** Draw the standard focus ring. Off for elements with their own focus treatment. */
  ring?: boolean;
  /** Focus arrived or left; rows use it to scroll the focused card into view. */
  onFocusChange?: (focused: boolean) => void;
  /** This element's box in its offset parent's coordinates, for a scroller following focus. */
  onExtent?: (box: { x: number; y: number; width: number; height: number }) => void;
  /** Directions this element keeps rather than yielding to the focus scorer. */
  ownsDirection?: (direction: TvDirection) => boolean;
  onDirection?: (direction: TvDirection) => void;
  /** A side rail, reachable sideways from any row (the alphabet strip). */
  rail?: boolean;
}

/**
 * One D-pad-focusable element, the Android TV client's `Focusable` on the
 * DOM. The border is always present and only changes colour: the focus
 * scorer reads these rectangles, so focus must not resize the element.
 */
export function Focusable({
  children,
  focusId,
  onSelect,
  disabled,
  defaultFocus,
  scope,
  style,
  focusedStyle,
  ring = true,
  onFocusChange,
  onExtent,
  ownsDirection,
  onDirection,
  rail,
}: FocusableProps): React.JSX.Element {
  const { focused, ref } = useFocusable({
    id: focusId,
    onSelect,
    disabled,
    defaultFocus,
    scope,
    ownsDirection,
    onDirection,
    rail,
  });

  const previous = useRef(focused);
  useEffect(() => {
    if (previous.current === focused) return;
    previous.current = focused;
    onFocusChange?.(focused);
  }, [focused, onFocusChange]);

  // After every commit, as React Native's `onLayout` reports every layout.
  const extent = useRef(onExtent);
  extent.current = onExtent;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !extent.current) return;
    extent.current({ x: element.offsetLeft, y: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight });
  });

  return (
    <div
      ref={ref}
      className="view"
      style={css(ring && styles.ring, ring && focused && styles.ringFocused, style, focused && focusedStyle)}
    >
      {typeof children === 'function' ? children({ focused }) : children}
    </div>
  );
}

const styles = {
  ring: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: radius.control,
  },
  ringFocused: {
    borderColor: colour.focus,
    // Stands in for `box-shadow: 0 0 14px var(--accent-glow)`, which the
    // Android client cannot cast either; the two clients agree on the wash.
    backgroundColor: colour.accentFocusWash,
  },
} satisfies Record<string, Style>;
