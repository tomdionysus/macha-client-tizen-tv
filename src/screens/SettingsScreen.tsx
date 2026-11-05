import { useEffect, useMemo, useState } from 'react';
import { css, Image, ScrollView, Text, View, type Style } from '../components/primitives';
import {
  checkPlatformSurface,
  displayQualityClass,
  sessionManager,
  type PlaybackCapabilities,
  type QualityClass,
} from '@machafoundation/core';
import { tizenPlatform } from '../platform/TizenPlatform';
import { useMacha } from '../app/MachaProvider';
import { useRefreshableAsync } from '../hooks/useAsync';
import {
  getBootstrapEndpoints,
  getDiscoveredEndpoints,
  setBootstrapEndpoints,
  setDiscoveredEndpoints,
} from '../state/client';
import { flushStorage } from '../state/storage';
import { changeEndpoints, restartAfterFlush } from '../app/endpointChange';
import { Focusable } from '../components/Focusable';
import { Button } from '../components/Button';
import { TvTextInput } from '../components/TvTextInput';
import { failureTrailEnabled, setFailureTrailEnabled } from '../diagnostics/failureTrailSetting';
import { QUALITY_CEILING_CHOICES, qualityPreferenceStore } from '../state/qualityPreference';
import { PageTitle } from '../components/Status';
import { usePageFocusScroll } from '../hooks/usePageFocusScroll';
import { machaIconUrl } from '../uiAssets';
import { clientVersion } from '../version';
import { colour, font, lineHeightPx, pageGutter, radius, rem, type } from '../styles/theme';
import {
  automaticCeilingLabel,
  catalogueStatusText,
  errorText,
  isSignedOut,
  qualityLabel,
  serverStatusText,
} from '../text/viewerText';

/**
 * Settings, section for section as the web client's: hero, status cards,
 * Connection, Diagnostics. Hardware decoding and Platform surface follow and
 * have no web counterpart. Endpoints are edited here because a television has
 * no address bar, so Settings stays reachable behind the login wall (`App.tsx`).
 */
export function SettingsScreen(): React.JSX.Element {
  const { services } = useMacha();
  const { scroller, measureRow, revealRow } = usePageFocusScroll(SCROLL_LEAD);

  const [capabilities, setCapabilities] = useState<PlaybackCapabilities | undefined>();
  const [error, setError] = useState<Error | undefined>();
  // Seeded from storage once: each setting changes only from its control here.
  const [trailEnabled, setTrailEnabled] = useState(failureTrailEnabled);
  const [ceiling, setCeiling] = useState<QualityClass | undefined>(() => qualityPreferenceStore().get().wifi);
  const [offerAll, setOfferAll] = useState(() => qualityPreferenceStore().get().offerAll ?? false);
  // The panel's class, the ceiling when none is set: core's screen rule,
  // which `qualityCeiling` applies.
  const screenClass = useMemo(() => {
    const display = tizenPlatform.display();
    return display ? displayQualityClass(display.width, display.height) : undefined;
  }, []);
  // Probed once: the answer cannot change while the app runs.
  const surface = useMemo(() => checkPlatformSurface(), []);

  const server = useRefreshableAsync(() => services.serverApi.status(), [services.serverApi]);
  const catalogue = useRefreshableAsync(
    () => services.catalogueApi.status(),
    [services.catalogueApi],
  );

  const [endpoints, setEndpoints] = useState(() => getBootstrapEndpoints().join(', '));
  const [endpointNotice, setEndpointNotice] = useState<string | undefined>();

  useEffect(() => {
    tizenPlatform
      .capabilities()
      .then(setCapabilities)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause : new Error(String(cause))),
      );
  }, []);

  /**
   * The state line, in the web client's order: server, catalogue, then
   * synchronising. Signed out outranks them all, or a 401 would read as
   * "catalogue unavailable".
   */
  const signedOut =
    isSignedOut(server.error) ||
    isSignedOut(catalogue.error) ||
    server.value?.httpStatus === 401 ||
    server.value?.httpStatus === 403;
  const overallState = signedOut
    ? "Signed out: sign in to see this server's state"
    : server.error
    ? 'Server unavailable'
    : catalogue.error
      ? 'Server online; catalogue unavailable'
      : catalogue.value?.ready
        ? 'Ready'
        : catalogue.loading || server.loading
          ? 'Checking system state…'
          : 'Server online; catalogue synchronising';

  const [restarting, setRestarting] = useState(false);

  /** The registry is built from the list at startup, so saving restarts the client. */
  const saveEndpoints = () => {
    if (restarting) return;
    const parsed = endpoints
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (parsed.length === 0) {
      setEndpointNotice('Give at least one endpoint, for example http://macha-node:7438');
      return;
    }
    setRestarting(true);
    setEndpointNotice('Saved. Restarting…');
    void changeEndpoints(getBootstrapEndpoints(), parsed, {
      signOut: () => sessionManager.signOut(),
      forgetDiscovered: () => setDiscoveredEndpoints([]),
      save: setBootstrapEndpoints,
      flush: flushStorage,
      restart: () => tizenPlatform.restartApplication(),
    }).catch(() => {
      setRestarting(false);
      setEndpointNotice('Saved, but Macha could not restart. Close it and open it again to connect to these.');
    });
  };

  const restart = () => {
    if (restarting) return;
    setRestarting(true);
    setEndpointNotice('Restarting…');
    void restartAfterFlush({ flush: flushStorage, restart: () => tizenPlatform.restartApplication() }).catch(() => {
      setRestarting(false);
      setEndpointNotice('Macha could not restart. Close it and open it again.');
    });
  };

  return (
    <ScrollView ref={scroller} contentStyle={styles.page}>
      {/* `.settings-hero` */}
      <View style={styles.hero}>
        <Image source={machaIconUrl} style={styles.heroLogo} resizeMode="contain" />
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>Media server</Text>
          <PageTitle>Macha</PageTitle>
          <Text style={styles.heroState}>{overallState}</Text>
        </View>
      </View>

      {/* `.settings-status-grid` */}
      <View style={styles.statusGrid}>
        <StatusCard
          label="Server"
          state={server.error ? 'Unavailable' : server.value ? 'Online' : 'Checking…'}
          rows={[
            ['Version', server.value?.version ?? (server.loading ? 'Checking…' : 'Not reported')],
            [
              'Playback',
              signedOut
                ? 'Sign in required'
                : server.error
                ? 'Unavailable'
                : server.value?.playbackAvailable
                  ? 'Available'
                  : 'Unavailable',
            ],
          ]}
          error={server.error ? errorText(server.error) : (server.value ? serverStatusText(server.value) : undefined)}
        />
        <StatusCard
          label="Catalogue"
          state={
            signedOut
              ? 'Sign in required'
              : catalogue.error
              ? 'Unavailable'
              : catalogue.value?.ready
                ? 'Ready'
                : catalogue.value
                  ? 'Synchronising'
                  : 'Checking…'
          }
          rows={[
            ['Items', catalogue.value ? String(catalogue.value.items) : '-'],
            [
              'Artwork',
              catalogue.value
                ? `${catalogue.value.local_artwork_objects}/${catalogue.value.artwork_objects} local`
                : '-',
            ],
            ['Generation', catalogue.value ? String(catalogue.value.metadata_generation) : '-'],
          ]}
          error={catalogue.error ? errorText(catalogue.error) : (catalogue.value ? catalogueStatusText(catalogue.value) : undefined)}
        />
        <StatusCard label="Client" state="Samsung TV" rows={[['Version', clientVersion]]} />
      </View>

      {/* `.settings-connection` */}
      <View ref={measureRow('connection')} style={styles.section}>
        <Text style={styles.heading}>Connection</Text>
        <Text style={styles.label}>Macha bootstrap API endpoints</Text>
        <TvTextInput
          value={endpoints}
          onChangeText={(value) => {
            setEndpoints(value);
            setEndpointNotice(undefined);
          }}
          onSubmit={saveEndpoints}
          placeholder="http://macha-node:7438"
        />
        <View style={styles.connectionActions}>
          <Button
            label="Save endpoints"
            onSelect={saveEndpoints}
            onFocusChange={(focused) => focused && revealRow('connection')}
          />
          <Button
            label="Restart"
            onSelect={restart}
            onFocusChange={(focused) => focused && revealRow('connection')}
            style={styles.connectionActionAfterFirst}
          />
        </View>
        {endpointNotice ? <Text style={styles.notice}>{endpointNotice}</Text> : null}
        {getDiscoveredEndpoints().length > 0 ? (
          <>
            <Text style={styles.label}>Discovered</Text>
            {getDiscoveredEndpoints().map((endpoint) => (
              <Text key={endpoint} style={styles.value}>
                {endpoint}
              </Text>
            ))}
          </>
        ) : null}
      </View>

      {/*
        Unset means the screen's own class. Caps automatic play only, never a
        version the viewer picks. No web rule to port.
      */}
      <View ref={measureRow('quality')} style={styles.section}>
        <Text style={styles.heading}>Playback</Text>
        <Text style={styles.label}>Highest quality for automatic play</Text>
        <View style={styles.choices}>
          {[undefined, ...QUALITY_CEILING_CHOICES].map((choice) => {
            const selected = ceiling === choice;
            return (
              <Focusable
                key={choice ?? 'screen'}
                onSelect={() => {
                  qualityPreferenceStore().set('wifi', choice);
                  setCeiling(choice);
                }}
                onFocusChange={(focused) => focused && revealRow('quality')}
                style={css(styles.choice, selected && styles.choiceSelected)}
                focusedStyle={styles.toggleFocused}
              >
                <Text style={css(styles.toggleState, selected && styles.toggleStateOn)}>
                  {choice === undefined ? automaticCeilingLabel(screenClass) : qualityLabel(choice)}
                </Text>
              </Focusable>
            );
          })}
        </View>
        <Text style={styles.note}>
          Applies to this television only, from the next thing played. Play and Resume choose the
          best version at or below it; the quality buttons beside them play what they say.
        </Text>
        {/* Off by default: only what the device plays is offered. */}
        <Focusable
          onSelect={() => {
            const next = !offerAll;
            qualityPreferenceStore().setOfferAll(next);
            setOfferAll(next);
          }}
          onFocusChange={(focused) => focused && revealRow('quality')}
          style={styles.toggle}
          focusedStyle={styles.toggleFocused}
        >
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Offer versions this television cannot play</Text>
            <Text style={css(styles.toggleState, offerAll && styles.toggleStateOn)}>
              {offerAll ? 'On' : 'Off'}
            </Text>
          </View>
        </Focusable>
        <Text style={styles.note}>
          Off, the quality buttons and the player's modes offer only what this television's
          decoders can play. On, they offer everything and say what may not play. Automatic
          play stays within the television either way.
        </Text>
      </View>

      {/* `.settings-diagnostics` */}
      <View ref={measureRow('diagnostics')} style={styles.section}>
        <Text style={styles.heading}>Diagnostics</Text>
        <Focusable
          onSelect={() => {
            const next = !trailEnabled;
            setFailureTrailEnabled(next);
            setTrailEnabled(next);
          }}
          onFocusChange={(focused) => focused && revealRow('diagnostics')}
          style={styles.toggle}
          focusedStyle={styles.toggleFocused}
        >
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show extended playback logging</Text>
            <Text style={css(styles.toggleState, trailEnabled && styles.toggleStateOn)}>
              {trailEnabled ? 'On' : 'Off'}
            </Text>
          </View>
        </Focusable>
        {/* Wider than the web client's "on errors": here it is also the running trail and the session id. */}
        <Text style={styles.note}>
          Prints the last warnings and errors under the failure message on the player, and, while
          a film is running, the session id and the trail as it fills. A television has no
          console, so without this a failover and a dead node look identical from across the room,
          and a failover that recovers silently leaves no trace at all.
        </Text>
      </View>

      {/* From here on, no web counterpart. */}
      <View ref={measureRow('decoding')} style={styles.section}>
        <ReadingStop onFocus={() => revealRow('decoding')}>
          <Text style={styles.heading}>Decoding</Text>
          {error ? <Text style={styles.error}>{errorText(error)}</Text> : null}
          {capabilities ? (
            <>
              <Capability name="Video" value={capabilities.videoCodecs.join(', ')} />
              <Capability name="Audio" value={capabilities.audioCodecs.join(', ')} />
              <Capability name="Containers" value={capabilities.containers.join(', ')} />
              <Capability name="HLS video" value={(capabilities.hlsVideoCodecs ?? capabilities.videoCodecs).join(', ')} />
              <Capability name="HLS audio" value={(capabilities.hlsAudioCodecs ?? capabilities.audioCodecs).join(', ')} />
              <Capability name="Bit depth" value={String(capabilities.videoBitDepth ?? 8)} />
              <Capability
                name="HDR"
                value={capabilities.hdr.length > 0 ? capabilities.hdr.join(', ') : 'SDR only'}
              />
              <Capability
                name="Dolby Vision"
                value={
                  capabilities.dolbyVision && capabilities.dolbyVision.length > 0
                    ? `profiles ${capabilities.dolbyVision.join(', ')}`
                    : 'none'
                }
              />
            </>
          ) : (
            <Text style={styles.value}>Asking the browser…</Text>
          )}
          <Text style={styles.note}>
            What this television's browser says it can play. It has no decoder list to read, and
            playback here always comes as HLS in MPEG-TS, whatever the file.
          </Text>
        </ReadingStop>
      </View>

      <View ref={measureRow('surface')} style={styles.section}>
        <ReadingStop onFocus={() => revealRow('surface')}>
          <Text style={styles.heading}>Platform surface</Text>
          {surface.map((finding) => (
            <View key={finding.name} style={styles.row}>
              <Text style={styles.rowName}>{finding.name}</Text>
              <Text
                style={css(
                  styles.rowValue,
                  finding.status === 'absent' && finding.required && styles.error,
                  !finding.required && finding.status !== 'present' && styles.rowValueMuted,
                )}
              >
                {finding.detail ?? finding.status}
              </Text>
            </View>
          ))}
          <Text style={styles.note}>
            Required members must all be present; optional ones absent here are expected on this
            browser and are handled by core's own guards.
          </Text>
        </ReadingStop>
      </View>
    </ScrollView>
  );
}

/**
 * A focus stop with nothing to press: the page scrolls only by following
 * focus, so a section without a control could not otherwise be reached.
 */
function ReadingStop({ onFocus, children }: { onFocus: () => void; children: React.ReactNode }): React.JSX.Element {
  return (
    <Focusable onFocusChange={(focused) => focused && onFocus()} style={styles.readingStop}>
      {children}
    </Focusable>
  );
}

/** `.settings-status-card` */
function StatusCard({
  label,
  state,
  rows,
  error,
}: {
  label: string;
  state: string;
  rows: [string, string][];
  error?: string;
}): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardState}>{state}</Text>
      {rows.map(([name, value]) => (
        <View key={name} style={styles.row}>
          <Text style={styles.rowName}>{name}</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
      ))}
      {error ? <Text style={styles.cardError}>{error}</Text> : null}
    </View>
  );
}

function Capability({ name, value }: { name: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowName}>{name}</Text>
      <Text style={styles.rowValue}>{value || '-'}</Text>
    </View>
  );
}

/** Margin above and below a control scrolled to: one line of text. */
const SCROLL_LEAD = rem(1.5);

const styles = {
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  /** `.settings-hero { display: flex; align-items: center; gap: 1.2rem }`. */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    marginBottom: rem(1.6),
  },
  heroLogo: {
    width: rem(4.6),
    height: rem(4.6),
    marginRight: rem(1.2),
  },
  heroCopy: {
    flex: 1,
  },
  /** `.eyebrow { text-transform: uppercase; letter-spacing: .08em }`. */
  eyebrow: {
    color: colour.textFaint,
    fontSize: type.eyebrow,
    textTransform: 'uppercase',
    letterSpacing: type.eyebrow * 0.08,
  },
  heroState: {
    color: colour.textDim,
    fontSize: type.subtitle,
  },
  /** `.settings-status-grid { display: grid; gap: .9rem }`, laid across on a TV. */
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: pageGutter,
    // Each card carries the gap on its right, so the last one's is taken off the gutter.
    paddingRight: pageGutter - rem(0.9),
    marginBottom: rem(1.1),
  },
  card: {
    flexGrow: 1,
    flexBasis: rem(16),
    marginRight: rem(0.9),
    marginBottom: rem(0.9),
    padding: rem(0.9),
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colour.hairline,
    backgroundColor: colour.surface,
  },
  cardLabel: {
    color: colour.textFaint,
    fontSize: type.eyebrow,
    textTransform: 'uppercase',
    letterSpacing: type.eyebrow * 0.08,
  },
  cardState: {
    color: colour.heading,
    fontSize: type.subtitle,
    fontWeight: font.weightMedium,
    marginBottom: rem(0.5),
  },
  cardError: {
    marginTop: rem(0.4),
    color: colour.error,
    fontSize: type.faint,
  },
  section: {
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    marginBottom: rem(2.2),
  },
  heading: {
    color: colour.heading,
    fontSize: type.h2,
    fontWeight: font.weightMedium,
    marginBottom: rem(0.6),
  },
  // `.settings label { display: block; color: var(--text-dim); margin: 1rem 0 .45rem }`
  label: {
    color: colour.textDim,
    marginTop: rem(1),
    marginBottom: rem(0.45),
    fontSize: type.body,
  },
  value: {
    color: colour.text,
    fontSize: type.body,
    marginBottom: rem(0.2),
  },
  notice: {
    marginTop: rem(0.5),
    color: colour.textDim,
    fontSize: type.small,
  },
  /** `.settings button { margin: .7rem 0 }`, left-aligned under the endpoint field. */
  connectionActions: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginTop: rem(0.8),
  },
  connectionActionAfterFirst: {
    marginLeft: rem(0.8),
  },
  // `.player-option-group { grid-template-columns: 6.5rem 1fr }`
  row: {
    flexDirection: 'row',
    marginBottom: rem(0.35),
  },
  rowName: {
    width: rem(9),
    color: colour.textFaint,
    fontSize: type.eyebrow,
    textTransform: 'uppercase',
    letterSpacing: type.eyebrow * 0.08,
    paddingTop: rem(0.15),
  },
  // The row's `gap: .8rem`.
  rowValue: {
    flex: 1,
    marginLeft: rem(0.8),
    color: colour.text,
    fontSize: type.body,
  },
  rowValueMuted: {
    color: colour.textFaint,
  },
  note: {
    marginTop: rem(1),
    color: colour.textFaint,
    fontSize: type.faint,
    lineHeight: lineHeightPx(type.faint * 1.35),
    maxWidth: rem(46),
  },
  error: {
    color: colour.error,
    fontWeight: font.weightMedium,
  },
  toggle: {
    alignSelf: 'flex-start',
    minWidth: rem(24),
    marginTop: rem(1),
    paddingTop: rem(0.6),
    paddingBottom: rem(0.6),
    paddingLeft: rem(0.9),
    paddingRight: rem(0.9),
    borderRadius: radius.control,
    backgroundColor: colour.surface2,
  },
  /** The ceiling's choices, in one row a D-pad crosses. */
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  /** `toggle` without its width: five of those would not fit one row. */
  choice: {
    marginRight: rem(0.5),
    marginBottom: rem(0.5),
    paddingTop: rem(0.6),
    paddingBottom: rem(0.6),
    paddingLeft: rem(0.9),
    paddingRight: rem(0.9),
    borderRadius: radius.control,
    backgroundColor: colour.surface2,
  },
  toggleFocused: {
    backgroundColor: colour.surface3,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // `gap: 1.5rem` before the state.
  toggleLabel: {
    marginRight: rem(1.5),
    color: colour.text,
    fontSize: type.body,
  },
  toggleState: {
    color: colour.textFaint,
    fontSize: type.body,
    fontWeight: font.weightMedium,
  },
  /** `.search-type-pill[aria-pressed='true'] { color: #dedee2 }`: lit, in the heading colour. */
  toggleStateOn: {
    color: colour.heading,
  },
  /** Room for the focus ring around a whole section. */
  readingStop: {
    padding: rem(0.6),
    marginLeft: -rem(0.6),
    marginRight: -rem(0.6),
    borderRadius: radius.control,
  },
  /** `[aria-pressed='true'] { background: var(--accent-surface-strong) }`. */
  choiceSelected: {
    backgroundColor: colour.accentSurfaceStrong,
  },
} satisfies Record<string, Style>;
