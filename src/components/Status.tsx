import { css, Spinner, Text, View, type Style } from './primitives';
import type { MediaSummary } from '@machafoundation/core';
import { AvailabilityMarker } from './AvailabilityMarker';
import { availabilityMarker } from './availability';
import { colour, font, lineHeightPx, pageGutter, px, rem, type } from '../styles/theme';
import { errorText } from '../text/viewerText';

/** `.status { padding: 5rem 0; font-size: 1.2rem; color: var(--text-dim) }` */
export function Loading({ label = 'Loading…' }: { label?: string }): React.JSX.Element {
  return (
    <View style={styles.status}>
      <Spinner colour={colour.focus} size={px(36)} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

/** `.error { color: #ffb4b4 }` */
export function ErrorMessage({ error }: { error: Error }): React.JSX.Element {
  return (
    <View style={styles.status}>
      <Text style={css(styles.statusText, styles.error)}>{errorText(error)}</Text>
    </View>
  );
}

/** `.media-refresh-error`: a refresh failure shown above content still on screen. */
export function RefreshError({ error }: { error: Error }): React.JSX.Element {
  return <Text style={styles.refreshError}>Refresh failed: {errorText(error)}</Text>;
}

/**
 * `h1 { font-size: clamp(2rem,4vw,4rem); margin: 1.4rem 0 1.2rem }`. Given
 * `media`, its availability marker goes before the heading.
 */
export function PageTitle({ children, media }: { children: string; media?: MediaSummary }): React.JSX.Element {
  if (!media || !availabilityMarker(media)) return <Text style={styles.h1}>{children}</Text>;
  return (
    <View style={styles.h1Row}>
      <AvailabilityMarker media={media} />
      <Text style={css(styles.h1, styles.h1InRow)}>{children}</Text>
    </View>
  );
}

const styles = {
  status: {
    paddingTop: rem(5),
    paddingBottom: rem(5),
    alignItems: 'center',
  },
  // `gap: 1rem` between the spinner and its label.
  statusText: {
    marginTop: rem(1),
    fontSize: type.subtitle,
    color: colour.textDim,
  },
  error: {
    color: colour.error,
  },
  refreshError: {
    marginBottom: rem(1),
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    color: colour.error,
  },
  h1: {
    // The web's `main` supplies the gutter; here each element applies its
    // own, so rails can reach the screen edge.
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    fontSize: type.h1,
    lineHeight: lineHeightPx(type.h1 * 1.02),
    letterSpacing: -type.h1 * 0.025,
    marginTop: rem(1.4),
    marginBottom: rem(1.2),
    color: colour.heading,
    fontWeight: font.weightMedium,
  },
  // The heading's gutter and margins move to the row so the marker shares them.
  h1Row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    marginTop: rem(1.4),
    marginBottom: rem(1.2),
  },
  // `gap: .6rem` after the marker.
  h1InRow: {
    flexShrink: 1,
    marginLeft: rem(0.6),
    paddingLeft: 0,
    paddingRight: 0,
    marginTop: 0,
    marginBottom: 0,
  },
} satisfies Record<string, Style>;
