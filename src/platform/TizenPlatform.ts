import {
  createClientLogger,
  type Platform,
  type PlaybackCapabilities,
  type PlaybackPolicyOverrides,
  type Player,
} from '@machafoundation/core';
import { detectHlsTsSupport, detectWebMediaCodecCapabilities, hlsDeliveryProbe } from './WebMediaCapabilities';
import { samsungDisplayResolution } from './displayResolution';
import { registerSamsungMediaKeys } from './SamsungMediaKeys';
import { TizenVideoPlayer } from '../player/TizenVideoPlayer';

function nativeHlsSupported(video: HTMLVideoElement): boolean {
  return video.canPlayType('application/vnd.apple.mpegurl') !== '' || video.canPlayType('application/x-mpegURL') !== '';
}

/**
 * The Samsung Tizen platform binding: the set's 2017 Chromium 47 browser as
 * an old Web target, not AVPlay. Playback goes through the media element's
 * own HLS player, so the decoder contract is narrower than the panel's. The
 * Android TV client's `AndroidTvPlatform` is this file's counterpart.
 */
export class TizenPlatform implements Platform {
  readonly name = 'tizen' as const;

  private cached?: PlaybackCapabilities;
  private readonly log = createClientLogger('playback.capabilities.tizen');

  /**
   * What to ask for, kept apart from `capabilities`, which state what the
   * engine decodes. Never narrow the capabilities to enforce a policy.
   */
  readonly playbackPolicy: PlaybackPolicyOverrides = {
    // Direct play leaves read-ahead to the media element, and nothing can
    // buffer for it here: a widget on `file://` cannot register a Service
    // Worker, and Chromium 47 MSE takes only fMP4 and WebM. Remux to segments
    // is a container rewrite with no re-encode.
    neverDirect: true,
    // ffmpeg names every Matroska file `matroska,webm`; this set decodes WebM but renders Matroska corrupt.
    excludeContainers: ['webm'],
    // MPEG-TS, not fMP4. In fMP4 HLS on this set, per stream: h264 plays,
    // HEVC is a black screen, E-AC-3 plays 0.2 s every 20 s and AAC is
    // silent. Every fault is fMP4's; MPEG-TS with both streams copied plays.
    // No codec exclusions: they move the failure to a worse branch.
    preferSegmentContainer: 'mpegts',
  };

  constructor() {
    if (typeof window !== 'undefined') registerSamsungMediaKeys(window);
  }

  /** The television owns volume: the element stays at unity and the remote's keys drive the set. */
  initialVolume(): number {
    return 1;
  }

  /**
   * What the engine claims to decode, asked once through `canPlayType`. The
   * HLS answers come from the playlist type, since that player is narrower
   * than the element's progressive-file decoder.
   */
  async capabilities(): Promise<PlaybackCapabilities> {
    if (this.cached) return this.cached;

    const video = document.createElement('video');
    const probe = (mime: string) => video.canPlayType(mime) !== '';
    const mediaFeature = typeof window.matchMedia === 'function'
      ? (query: string) => window.matchMedia(query).matches
      : undefined;
    const { videoCodecs, hlsVideoCodecs, audioCodecs, hlsAudioCodecs, containers, videoBitDepth, hdrTransfers, dolbyVision } =
      detectWebMediaCodecCapabilities(probe, mediaFeature, hlsDeliveryProbe(probe));

    const capabilities: PlaybackCapabilities = {
      platform: 'tizen',
      videoCodecs,
      audioCodecs,
      containers,
      hlsFmp4: nativeHlsSupported(video),
      // Probed separately: this set plays MPEG-TS segments and black-screens on fMP4.
      hlsTs: detectHlsTsSupport(probe),
      dash: false,
      // Both gate what the server hands over. Over-claiming gives a black
      // screen; under-claiming only a needless transcode.
      hdr: hdrTransfers,
      videoBitDepth,
      // What the HLS player accepts, sent only when it differs from the
      // element's list, which the chooser falls back to.
      ...(hlsVideoCodecs.length !== videoCodecs.length ? { hlsVideoCodecs } : {}),
      ...(hlsAudioCodecs.length !== audioCodecs.length ? { hlsAudioCodecs } : {}),
      // Omitted when empty: absent and empty mean the same.
      ...(dolbyVision.length > 0 ? { dolbyVision } : {}),
    };
    this.log.info('detected-html5-profile', {
      platform: capabilities.platform,
      containers: capabilities.containers.join(', '),
      videoCodecs: capabilities.videoCodecs.join(', '),
      audioCodecs: capabilities.audioCodecs.join(', '),
      hlsFmp4: capabilities.hlsFmp4,
      hlsTs: capabilities.hlsTs,
      decoderResolutionLimit: 'none',
      hdr: capabilities.hdr.length > 0 ? capabilities.hdr.join(', ') : 'not-advertised',
    });

    this.cached = capabilities;
    return capabilities;
  }

  /**
   * The panel's mode, for the quality ceiling; undefined leaves automatic
   * play uncapped. Always undefined here: see `samsungDisplayResolution`.
   */
  display(): { width: number; height: number } | undefined {
    return samsungDisplayResolution();
  }

  /** The player core drives. Called once, from `PlaybackRuntime`. */
  createPlayer(): Player {
    return new TizenVideoPlayer();
  }

  exitApplication(): void {
    const tizen = (window as Window & {
      tizen?: {
        application?: {
          getCurrentApplication?: () => { exit?: () => void };
        };
      };
    }).tizen;
    tizen?.application?.getCurrentApplication?.().exit?.();
  }

  /** Reloads the application; storage is re-read on the way back up. */
  restartApplication(): void {
    window.location.reload();
  }
}

export const tizenPlatform = new TizenPlatform();
