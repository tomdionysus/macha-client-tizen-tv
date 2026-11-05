import { forwardRef, type CSSProperties, type ReactNode } from 'react';

/**
 * The boxes the Android TV client builds its screens from, on the DOM: a
 * `View` is a flex column, a `Text` a block of words, so a screen here reads
 * line for line as its React Native counterpart. `styles.css` carries the
 * defaults (`.view`, `.text`); everything else is inline.
 */

export type Style = CSSProperties;

/** `[a, condition && b]` in React Native: the later styles win. */
export function css(...styles: (Style | false | null | undefined)[]): Style {
  const merged: Style = {};
  for (const style of styles) if (style) Object.assign(merged, style);
  return merged;
}

export interface ViewProps {
  style?: Style;
  children?: ReactNode;
  /** `pointerEvents="none"`: an overlay the D-pad never reaches has nothing to intercept here, kept for the mouse a developer plugs in. */
  pointerEvents?: 'none';
}

export const View = forwardRef<HTMLDivElement, ViewProps>(function View({ style, children, pointerEvents }, ref) {
  return (
    <div ref={ref} className="view" style={pointerEvents ? { ...style, pointerEvents } : style}>
      {children}
    </div>
  );
});

export interface TextProps {
  style?: Style;
  children?: ReactNode;
  /** Truncates with an ellipsis after this many lines. */
  numberOfLines?: number;
}

export function Text({ style, children, numberOfLines }: TextProps): React.JSX.Element {
  if (numberOfLines === 1) {
    return <div className="text text-1" style={style}>{children}</div>;
  }
  if (numberOfLines !== undefined && numberOfLines > 1) {
    return <div className="text text-n" style={{ ...style, WebkitLineClamp: numberOfLines }}>{children}</div>;
  }
  return <div className="text" style={style}>{children}</div>;
}

export interface ScrollViewProps {
  style?: Style;
  /** The scrolled content's box: `contentContainerStyle`. */
  contentStyle?: Style;
  horizontal?: boolean;
  children?: ReactNode;
}

/**
 * A box whose content may be taller or wider than it. Nothing scrolls it but
 * a screen following focus, through the ref's `scrollTop` or `scrollLeft`.
 */
export const ScrollView = forwardRef<HTMLDivElement, ScrollViewProps>(function ScrollView(
  { style, contentStyle, horizontal, children },
  ref,
) {
  return (
    <div ref={ref} className={horizontal ? 'scroller-horizontal' : 'view scroller'} style={style}>
      <div className="view" style={contentStyle}>{children}</div>
    </div>
  );
});

export interface ImageProps {
  source: string;
  style?: Style;
  resizeMode?: 'cover' | 'contain';
  onLoad?: () => void;
  onError?: () => void;
}

export function Image({ source, style, resizeMode = 'cover', onLoad, onError }: ImageProps): React.JSX.Element {
  return <img src={source} alt="" draggable={false} style={{ objectFit: resizeMode, ...style }} onLoad={onLoad} onError={onError} />;
}

/** `ActivityIndicator`: the one animated element on the set. */
export function Spinner({ size, colour: stroke }: { size: number; colour: string }): React.JSX.Element {
  return <div className="spinner" style={{ width: size, height: size, color: stroke }} />;
}
