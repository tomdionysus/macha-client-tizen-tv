import { css, View, type Style } from './primitives';
import type { MediaSummary } from '@machafoundation/core';
import { availabilityMarker, type AvailabilityMarkerKind } from './availability';
import { colour, rem } from '../styles/theme';

/**
 * A title's availability marker on a dark disc, or nothing. `overlay` places
 * it at the artwork's top left; otherwise it sits inline before a heading.
 */
export function AvailabilityMarker({
  media,
  overlay = false,
  style,
}: {
  media: Pick<MediaSummary, 'availability'>;
  overlay?: boolean;
  style?: Style;
}): React.JSX.Element | null {
  const kind = availabilityMarker(media);
  if (!kind) return null;
  return (
    <View style={css(styles.disc, overlay && styles.overlay, style)}>
      <MarkerIcon kind={kind} size={rem(1.2)} />
    </View>
  );
}

function MarkerIcon({ kind, size }: { kind: AvailabilityMarkerKind; size: number }): React.JSX.Element {
  switch (kind) {
    case 'partial':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 3 22 20.5H2Z" stroke={colour.availabilityYellow} strokeWidth={2} strokeLinejoin="round" />
          <path d="M12 9.5v4.6M12 17.4v.2" stroke={colour.availabilityYellow} strokeWidth={2.2} strokeLinecap="round" />
        </svg>
      );
    case 'unavailable':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={colour.availabilityRed} strokeWidth={2.2} />
          <path d="M5.6 18.4 18.4 5.6" stroke={colour.availabilityRed} strokeWidth={2.2} strokeLinecap="round" />
        </svg>
      );
    case 'unknown':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M8.6 9a3.5 3.5 0 1 1 5.1 3.1c-1 .5-1.7 1.3-1.7 2.4v.6"
            stroke={colour.availabilityYellow}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <path d="M12 19.1v.2" stroke={colour.availabilityYellow} strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      );
  }
}

const styles = {
  // The size and fill of `.card-close-button`, so the two corners match.
  disc: {
    width: rem(1.8),
    height: rem(1.8),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rem(0.9),
    backgroundColor: colour.markerSurface,
  },
  // `.continue-card-remove`'s inset, on the opposite corner.
  overlay: {
    position: 'absolute',
    top: rem(0.78),
    left: rem(0.78),
  },
} satisfies Record<string, Style>;
