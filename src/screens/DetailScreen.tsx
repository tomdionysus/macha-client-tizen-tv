import { css, Image, ScrollView, Text, View, type Style } from '../components/primitives';
import type { MediaSummary, VersionStep } from '@machafoundation/core';
import { usePlaybackVersions } from '../app/usePlaybackVersions';
import { AvailabilityMarker } from '../components/AvailabilityMarker';
import { availableToPlay } from '@machafoundation/core';
import { Focusable } from '../components/Focusable';
import { PlayerIcon, type PlayerIconName } from '../components/PlayerIcons';
import { clamp, colour, font, lineHeightPx, pageGutter, px, radius, rem, type, vw } from '../styles/theme';
import { useFileLines } from '../app/useFileLines';
import { qualityChoiceText, qualityLabel } from '../text/viewerText';

/**
 * Movie detail, from `.detail` / `.movie-detail-layout` in base.css. The
 * backdrop is drawn at reduced opacity rather than masked, as on the Android
 * client.
 */
export function DetailScreen({
  media,
  resumePositionMs,
  onPlay,
  onBack,
}: {
  media: MediaSummary;
  resumePositionMs: number;
  /** With a version, that version as the viewer's choice; without, core decides. */
  onPlay: (positionMs: number, version?: VersionStep) => void;
  onBack: () => void;
}): React.JSX.Element {
  const poster = media.artwork?.poster ?? media.artwork?.thumbnail;
  const backdrop = media.artwork?.backdrop;
  const canResume = resumePositionMs > 0;
  // An unavailable title offers nothing to play.
  const playable = availableToPlay(media);
  const { versions } = usePlaybackVersions(media);
  const lines = useFileLines(media);
  // The quality buttons show only when there is a choice.
  const steps = versions && versions.steps.length > 1 ? versions.steps : [];

  return (
    <ScrollView contentStyle={styles.page}>
      {/* `.detail-backdrop { height: 58vh; opacity: .28 }` */}
      {backdrop?.url ? (
        <Image source={backdrop.url} style={styles.backdrop} resizeMode="cover" />
      ) : null}

      {/* `.back-button` */}
      <Focusable
        ring={false}
        onSelect={onBack}
        style={styles.backButton}
        focusedStyle={styles.backButtonFocused}
      >
        <Text style={styles.backLabel}>{'←'} Back</Text>
      </Focusable>

      <View style={styles.layout}>
        <View style={styles.poster}>
          {poster?.url ? (
            <Image source={poster.url} style={styles.posterImage} resizeMode="cover" />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Text style={styles.posterGlyph}>{media.title.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <AvailabilityMarker media={media} overlay />
        </View>

        <View style={styles.copy}>
          {media.kind ? <Text style={styles.eyebrow}>{media.kind}</Text> : null}
          <Text style={styles.h1} numberOfLines={2}>
            {media.title}
          </Text>
          {media.year ? <Text style={styles.subtitle}>{media.year}</Text> : null}
          {/* `.media-profile-summary`: one line per file. */}
          {lines.map((line) => (
            <Text key={line} style={styles.fileLine}>
              {line}
            </Text>
          ))}

          {/* `.play-actions.detail-play-controls`: round `.media-control-button`s. */}
          {playable ? (
            <View style={styles.actions}>
              <ControlButton
                icon="play"
                defaultFocus
                onSelect={() => onPlay(canResume ? resumePositionMs : 0)}
              />
              {canResume ? <ControlButton icon="restart" onSelect={() => onPlay(0)} /> : null}
              {/* One button per quality, each playing that version as the viewer's choice. */}
              {steps.map((step) => (
                <VersionButton
                  key={step.quality}
                  step={step}
                  onSelect={() => onPlay(canResume ? resumePositionMs : 0, step)}
                />
              ))}
            </View>
          ) : null}
          {playable && steps.length > 0 && versions && qualityChoiceText(versions) ? (
            <Text style={styles.versionNote}>{qualityChoiceText(versions)}</Text>
          ) : null}
        </View>
      </View>

      {/* A TV divergence: the web client keeps the synopsis in the copy column. */}
      {media.synopsis ? (
        <Text style={styles.synopsisBelow} numberOfLines={6}>
          {media.synopsis}
        </Text>
      ) : null}
    </ScrollView>
  );
}

/** `.media-control-button`: the transport row's 3.25rem circle. */
function ControlButton({
  icon,
  onSelect,
  defaultFocus,
}: {
  icon: PlayerIconName;
  onSelect: () => void;
  defaultFocus?: boolean;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      onSelect={onSelect}
      defaultFocus={defaultFocus}
      style={css(styles.controlButton, styles.action)}
      focusedStyle={styles.controlButtonFocused}
    >
      <PlayerIcon name={icon} />
    </Focusable>
  );
}

/** `.media-quality-button`: one version, labelled by its quality, as a pill. */
function VersionButton({ step, onSelect }: { step: VersionStep; onSelect: () => void }): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      onSelect={onSelect}
      style={css(styles.versionButton, styles.action)}
      focusedStyle={styles.controlButtonFocused}
    >
      <Text style={styles.versionQuality}>{qualityLabel(step.quality)}</Text>
    </Focusable>
  );
}

/** `.movie-detail-poster { width: clamp(190px, 22vw, 310px) }`. */
const POSTER_WIDTH = clamp(px(190), vw(22), px(310));

const styles = {
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    width: '100%',
    height: '58%',
    opacity: 0.28,
  },
  // `.movie-detail-layout { grid-template-columns: clamp(190px,22vw,310px) minmax(0,1fr); gap: clamp(1.6rem,4vw,3.8rem) }`
  layout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    marginTop: rem(0.8),
  },
  // `.movie-detail-poster { aspect-ratio: 2/3; border-radius: .7rem }`
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_WIDTH * 1.5,
    borderRadius: rem(0.7),
    overflow: 'hidden',
    backgroundColor: colour.surface2,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterGlyph: {
    fontSize: rem(5),
    fontWeight: font.weightBold,
    color: colour.placeholderGlyph,
  },
  // The layout's gap, beside the poster.
  copy: {
    flex: 1,
    marginLeft: clamp(rem(1.6), vw(4), rem(3.8)),
  },
  // `.eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .78rem }`
  eyebrow: {
    color: colour.textDim,
    textTransform: 'uppercase',
    letterSpacing: type.eyebrow * 0.12,
    fontSize: type.eyebrow,
  },
  h1: {
    fontSize: type.h1,
    lineHeight: lineHeightPx(type.h1 * 1.02),
    letterSpacing: -type.h1 * 0.025,
    marginTop: rem(0.6),
    marginBottom: rem(0.6),
    color: colour.heading,
    fontWeight: font.weightMedium,
  },
  // `.subtitle { color: var(--text-dim); font-size: 1.1rem }`
  subtitle: {
    color: colour.textDim,
    fontSize: type.subtitle,
  },
  /** `.media-profile-summary { color: var(--text-dim); font-size: .95rem; letter-spacing: .025em }`. */
  fileLine: {
    marginTop: rem(0.4),
    color: colour.textDim,
    fontSize: rem(0.95),
    letterSpacing: rem(0.95) * 0.025,
  },
  // `.synopsis { max-width: 70ch; line-height: 1.65; font-size: clamp(1rem,1.35vw,1.25rem) }`
  synopsisBelow: {
    marginTop: rem(1.4),
    marginLeft: pageGutter,
    marginRight: pageGutter,
    maxWidth: rem(60),
    lineHeight: lineHeightPx(type.synopsis * 1.65),
    fontSize: type.synopsis,
    color: colour.bodyBright,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: rem(1),
  },
  /** The actions' `gap: .7rem`, on each control. */
  action: {
    marginRight: rem(0.7),
    marginBottom: rem(0.7),
  },
  /**
   * `.media-control-button { width: 3.25rem; height: 3.25rem; border-radius: 50%;
   * border: 1px solid #48484f; background: #080809d6 }`.
   */
  controlButton: {
    width: rem(3.25),
    height: rem(3.25),
    borderRadius: rem(3.25) / 2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#48484f',
    backgroundColor: 'rgba(8,8,9,0.839)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `.media-control-button`'s frame, as a pill; see `VersionButton`. */
  versionButton: {
    height: rem(3.25),
    paddingLeft: rem(1.1),
    paddingRight: rem(1.1),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#48484f',
    backgroundColor: 'rgba(8,8,9,0.839)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  versionQuality: {
    color: colour.heading,
    fontSize: type.body,
    fontWeight: font.weightSemibold,
  },
  /** The same size and colour as `.player-option-note`. */
  versionNote: {
    marginTop: rem(0.6),
    color: colour.textFaint,
    fontSize: type.faint,
  },
  /** `:focus-visible { background: #160004e8; border-color: #620014 }`. */
  controlButtonFocused: {
    backgroundColor: 'rgba(22,0,4,0.910)',
    borderColor: '#620014',
  },
  /** `.back-button` shares `.topbar nav a`: `padding: .65rem .9rem; radius: .55rem`. */
  backButton: {
    alignSelf: 'flex-start',
    marginLeft: pageGutter,
    marginBottom: rem(0.6),
    paddingTop: rem(0.65),
    paddingBottom: rem(0.65),
    paddingLeft: rem(0.9),
    paddingRight: rem(0.9),
    borderRadius: radius.control,
  },
  backButtonFocused: {
    backgroundColor: colour.accentSurface,
  },
  backLabel: {
    color: colour.textDim,
    fontSize: type.body,
    fontWeight: font.weightMedium,
  },
} satisfies Record<string, Style>;
