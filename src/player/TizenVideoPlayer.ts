import {
  createClientLogger,
  MediaStallWatchdog,
  MediaStartWatchdog,
  PlaybackSourceError,
  preflightHlsSource,
  type PlaybackEvent,
  type PlaybackHost,
  type PlaybackSource,
  type PlaybackTimeRange,
  type Player,
} from '@machafoundation/core';
import { browserMediaWatchdogEnvironment } from '../platform/mediaWatchdogEnvironment';
import { WebMediaTimeline } from '../platform/WebMediaTimeline';
import { VideoSubtitles } from './videoSubtitles';

/**
 * Core's `Player` over Chromium 47's media element and the set's native HLS
 * player: the counterpart of the Android TV client's `ExpoVideoAdapter`,
 * and the native half of the web client's `WebPlatform`, which this set ran
 * for a month. One element, one source at a time: no standby, no handover,
 * no hls.js (Chromium 47 MSE takes only fMP4, which this set breaks on).
 *
 * What the element does not report, the watchdogs do: a source that
 * delivers nothing (`MediaStartWatchdog`) and a picture that freezes with
 * nothing arriving (`MediaStallWatchdog`), both as `stream` failures so the
 * coordinator moves to another node. The native player has been measured
 * swallowing a failure without an `error` event, so the stall budget is the
 * whole of failover detection here.
 */
export class TizenVideoPlayer implements Player {
  /**
   * Native HLS treats a `500 segment_not_ready` first fragment as a permanent
   * network failure, so core holds the source until the node has produced it.
   */
  readonly needsProducedSource = true;

  private host?: HTMLElement;
  private video?: HTMLVideoElement;
  private listeners = new Set<(event: PlaybackEvent) => void>();
  private failureListeners = new Set<(error: Error) => void>();
  private readonly log = createClientLogger('playback.tizen');
  private readonly subtitles = new VideoSubtitles(this.log);
  private volume = 1;

  /**
   * Whether the viewer wants this playing. Not `!video.paused`: between a
   * play request and the element running, the viewer is waiting.
   */
  private wantsPlayback = false;
  private playRequestGeneration = 0;
  private activeSource?: PlaybackSource;
  /** Which `play()` is current; events from a source since replaced are ignored. */
  private sourceGeneration = 0;
  private failedSourceGeneration?: number;
  private mediaTimeline?: WebMediaTimeline;
  private lastPublishedEvent?: PlaybackEvent;
  private initialSeekCleanup?: () => void;

  /**
   * A terminal error raised while paused. Nobody is waiting, so it is held
   * and the source re-asked at `resume()` instead of reported, as the Android
   * client parks it (`ExpoVideoAdapter.parked`).
   */
  private parked?: { source: PlaybackSource; positionMs: number; message: string };

  private readonly startWatchdog = new MediaStartWatchdog(browserMediaWatchdogEnvironment);
  private readonly stallWatchdog = new MediaStallWatchdog(browserMediaWatchdogEnvironment);

  /** Binds presentation only; must not create a playback session. */
  attach(host: PlaybackHost): void {
    const element = host as HTMLElement;
    this.host = element;
    const video = this.video;
    if (video && video.parentNode !== element) {
      while (element.firstChild) element.removeChild(element.firstChild);
      element.appendChild(video);
    }
    this.log.debug('attach');
  }

  detachHost(): void {
    this.log.debug('detach-host');
    this.host = undefined;
  }

  detach(): void {
    this.log.debug('detach');
    this.stop();
    this.host = undefined;
  }

  /**
   * Resolves once dispatched, never when buffering completes: waiting would
   * stall the coordinator's failover timing. Every replacement is an
   * ordinary attach: the element is reused, so `transition` changes nothing.
   */
  async play(source: PlaybackSource, positionMs = 0, startPaused = false): Promise<boolean> {
    if (!this.host) throw new Error('Player must be attached before playback');
    // Only a player holding through a lead is handed a negative position;
    // this one is not, so this is a guard, not a path.
    positionMs = Math.max(0, positionMs);
    const playRequestGeneration = ++this.playRequestGeneration;
    const sourceGeneration = ++this.sourceGeneration;
    this.failedSourceGeneration = undefined;
    this.wantsPlayback = !startPaused;
    // Anything parked belonged to the generation being replaced.
    this.parked = undefined;
    // Cleared first so teardown events from the previous source are ignored and
    // the new timeline learns no origin from the reused element's old buffer.
    this.activeSource = undefined;
    this.mediaTimeline = undefined;
    this.lastPublishedEvent = undefined;
    this.log.info('source-load-begin', {
      mode: source.mode,
      mimeType: source.mimeType,
      mediaId: source.mediaId,
      url: source.url,
      subtitleUrl: source.subtitleUrl,
      requestedPositionMs: positionMs,
      hls: source.isManifest,
    });
    this.initialSeekCleanup?.();
    this.initialSeekCleanup = undefined;
    this.startWatchdog.stop();
    this.stallWatchdog.stop();

    const existing = this.video;
    const video = this.ensureMediaElement();
    // The element is reused across generations: recreating it drops the
    // picture for as long as the node takes.
    if (existing) video.pause();

    this.activeSource = source;
    this.attachSource(video, source, positionMs, playRequestGeneration, sourceGeneration);

    if (sourceGeneration !== this.sourceGeneration || this.failedSourceGeneration === sourceGeneration) return false;
    const playStarted = performance.now();
    if (startPaused) {
      video.pause();
      this.log.info('source-attached-paused', { state: videoState(video) });
    } else {
      this.requestPlay(video, 'source-attached', playRequestGeneration);
    }
    this.log.info('source-load-dispatched', {
      elapsedMs: Math.round((performance.now() - playStarted) * 10) / 10,
      startPaused,
      state: videoState(video),
    });
    return true;
  }

  /**
   * Point the element at a source and arm what watches it. `positionMs` is the
   * server's `seek_offset_ms` into the generation: where to seek to once the
   * media clock's origin is known, not where that clock begins.
   */
  private attachSource(
    video: HTMLVideoElement,
    source: PlaybackSource,
    positionMs: number,
    playRequestGeneration: number,
    sourceGeneration: number,
  ): void {
    this.mediaTimeline = new WebMediaTimeline(source.mode, positionMs, 'generation-start');

    if (positionMs > 0) {
      const readinessEvents = ['loadedmetadata', 'loadeddata', 'canplay'] as const;
      const cleanupInitialSeek = () => {
        for (const name of readinessEvents) video.removeEventListener(name, initialSeek);
        if (this.initialSeekCleanup === cleanupInitialSeek) this.initialSeekCleanup = undefined;
      };
      const initialSeek = () => {
        if (playRequestGeneration !== this.playRequestGeneration || video !== this.video) {
          cleanupInitialSeek();
          return;
        }
        // publish() establishes the media-clock origin first: the HLS player
        // may expose a non-zero clock, so a source-local time never goes
        // straight into currentTime.
        this.publish(video);
        const targetMediaMs = this.mediaTimeline?.toMediaTime(positionMs);
        if (targetMediaMs === undefined) return;
        this.log.info('initial-local-seek', {
          requestedPositionMs: positionMs,
          targetMediaMs,
          mediaOriginMs: this.mediaTimeline?.mediaOriginMs,
          before: videoState(video),
        });
        video.currentTime = targetMediaMs / 1000;
        cleanupInitialSeek();
        this.publish(video);
      };
      for (const name of readinessEvents) video.addEventListener(name, initialSeek);
      this.initialSeekCleanup = cleanupInitialSeek;
    }

    void this.subtitles.apply(video, source.subtitleUrl).catch((error) => {
      this.log.warn('subtitle-initial-load-failed', { url: source.subtitleUrl, error: error instanceof Error ? error.message : String(error) });
    });

    // Declared by the resolver, never sniffed. The element plays a playlist
    // and a plain file through the same property; no reset first, since
    // assigning `src` already supersedes the previous load.
    this.log.info(source.isManifest ? 'hls-native-selected' : 'direct-source-selected', { url: source.url });
    video.src = source.url;
    this.watchForStarvedStart(video, source, sourceGeneration);
    this.watchForStall(video, source, sourceGeneration);
  }

  private ensureMediaElement(): HTMLVideoElement {
    if (this.video) return this.video;
    const video = this.createWiredMediaElement();
    this.video = video;
    const host = this.host;
    if (host) {
      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(video);
    }
    return video;
  }

  private createWiredMediaElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.autoplay = true;
    video.controls = false;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.volume = this.volume;
    // Chromium 47 honours the attributes over the properties.
    video.muted = false;
    video.defaultMuted = false;
    video.removeAttribute('muted');
    video.setAttribute('autoplay', 'autoplay');
    video.setAttribute('preload', 'auto');
    video.style.position = 'absolute';
    video.style.left = '0';
    video.style.top = '0';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.background = '#000000';

    const publish = () => this.publish(video);
    for (const name of [
      'timeupdate', 'progress', 'pause', 'play', 'playing', 'waiting', 'seeking', 'seeked',
      'loadedmetadata', 'loadeddata', 'durationchange', 'canplay', 'emptied', 'ended',
    ] as const) {
      video.addEventListener(name, publish);
    }
    video.addEventListener('error', () => {
      // Teardown clears activeSource before removing src; those element events
      // are not a generation failure.
      if (!this.activeSource || video !== this.video) return;
      const failure = webMediaElementFailure(video.error);
      // Nobody is waiting: park and re-ask on resume. See `parked`.
      if (!this.wantsPlayback) {
        this.parked = {
          source: this.activeSource,
          positionMs: this.lastPublishedEvent?.positionMs ?? 0,
          message: failure.message,
        };
        this.startWatchdog.stop();
        this.stallWatchdog.stop();
        this.log.warn('failure-parked-while-paused', { message: failure.message, state: videoState(video) });
        return;
      }
      this.failSourceGeneration(this.sourceGeneration, failure, videoState(video));
    });
    // Evidence that bytes reached the element, ending the start watchdog.
    // `progress` fires long before readyState leaves HAVE_NOTHING; the rest
    // cover an engine that reaches readiness without one.
    for (const name of ['progress', 'loadedmetadata', 'loadeddata', 'canplay', 'playing', 'error'] as const) {
      video.addEventListener(name, () => this.startWatchdog.noteProgress());
    }
    const resumeWhenReady = () => {
      if (!this.wantsPlayback || !video.paused) return;
      this.requestPlay(video, 'media-ready');
    };
    // The engine may reject a play() made before the element has a usable
    // source; readiness events retry it.
    video.addEventListener('loadedmetadata', resumeWhenReady);
    video.addEventListener('loadeddata', resumeWhenReady);
    video.addEventListener('canplay', resumeWhenReady);
    return video;
  }

  pause(): void {
    this.playRequestGeneration += 1;
    this.log.info('pause-request', this.video ? videoState(this.video) : undefined);
    this.wantsPlayback = false;
    // Paused is not stalled: the stall countdown is suspended, not switched
    // off. Core re-arms it on the first report after the resume.
    this.stallWatchdog.suspend();
    this.video?.pause();
  }

  resume(): void {
    this.playRequestGeneration += 1;
    const video = this.video;
    if (!video) {
      this.wantsPlayback = true;
      this.log.debug('resume-intent-before-media');
      return;
    }
    this.log.info('resume-request', videoState(video));
    this.wantsPlayback = true;
    // Before the play request, so a source that died while paused is met with
    // the viewer waiting.
    this.restartParkedSource(video);
    this.requestPlay(video, 'resume');
  }

  /**
   * Re-attach a source that died while paused, at the position left. An
   * element in its error state will not resume, so the buffer is lost. The
   * watchdogs are re-armed, as for any acquisition.
   */
  private restartParkedSource(video: HTMLVideoElement): void {
    const parked = this.parked;
    if (!parked) return;
    this.parked = undefined;
    this.log.warn('parked-source-restarted', {
      url: parked.source.url,
      positionMs: Math.round(parked.positionMs),
      message: parked.message,
    });
    this.initialSeekCleanup?.();
    this.initialSeekCleanup = undefined;
    this.lastPublishedEvent = undefined;
    this.attachSource(video, parked.source, parked.positionMs, this.playRequestGeneration, this.sourceGeneration);
  }

  private requestPlay(video: HTMLVideoElement, reason: string, expectedGeneration = this.playRequestGeneration): void {
    if (!this.wantsPlayback || expectedGeneration !== this.playRequestGeneration || video !== this.video) return;
    try {
      // Chromium 47's play() returns nothing; a promise is handled in case the engine grows one.
      const result = video.play() as Promise<void> | undefined;
      if (!result || typeof result.then !== 'function') {
        this.log.debug('play-requested-legacy', { reason, state: videoState(video) });
        return;
      }
      void result.then(() => {
        if (!this.wantsPlayback || expectedGeneration !== this.playRequestGeneration || video !== this.video) return;
        this.log.info(reason === 'resume' ? 'resume-started' : 'autoplay-started', { reason, state: videoState(video) });
      }).catch((error) => {
        if (!this.wantsPlayback || expectedGeneration !== this.playRequestGeneration || video !== this.video) return;
        if (video.readyState === HTMLMediaElement.HAVE_NOTHING) {
          this.log.debug('play-deferred-until-media-ready', { reason, error, state: videoState(video) });
          return;
        }
        this.log.warn('play-request-failed', { reason, error, state: videoState(video) });
      });
    } catch (error) {
      if (!this.wantsPlayback || expectedGeneration !== this.playRequestGeneration || video !== this.video) return;
      this.log.debug('play-request-threw-before-media-ready', { reason, error, state: videoState(video) });
    }
  }

  seek(positionMs: number): void {
    const video = this.video;
    if (!video) {
      this.log.warn('local-seek-without-media', { positionMs });
      return;
    }
    this.publish(video);
    const targetMediaMs = this.mediaTimeline?.toMediaTime(positionMs);
    if (targetMediaMs === undefined) {
      this.log.warn('local-seek-before-timeline-origin', { positionMs, state: videoState(video) });
      return;
    }
    this.log.info('local-seek-request', {
      positionMs,
      targetMediaMs,
      mediaOriginMs: this.mediaTimeline?.mediaOriginMs,
      state: videoState(video),
    });
    video.currentTime = targetMediaMs / 1000;
  }

  /**
   * Same coordinates as `seek()`, local to the source generation. Published
   * first, so local-seek admission and the buffer indicator share one authority.
   */
  localSeekCoverage(): readonly PlaybackTimeRange[] {
    const video = this.video;
    if (!video || !this.activeSource) return [];
    this.publish(video);
    return this.lastPublishedEvent?.bufferedRangesMs ?? [];
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
    const video = this.video;
    if (!video) return;
    video.volume = this.volume;
    if (this.volume > 0) {
      video.muted = false;
      video.defaultMuted = false;
      video.removeAttribute('muted');
    }
  }

  /** Replaces the subtitle resource without touching active A/V playback. */
  async setSubtitle(subtitleUrl?: string): Promise<void> {
    const video = this.video;
    if (!video) throw new Error('Player has no active media element');
    this.log.info('subtitle-source-update', { url: subtitleUrl ?? 'off' });
    await this.subtitles.apply(video, subtitleUrl);
  }

  /**
   * Validate a source without replacing the active presentation. Core
   * discards the replacement when this answers `false`. No decoder is
   * involved: the walk is `fetch` and a range request.
   */
  preflightSource(source: PlaybackSource): Promise<boolean> {
    return preflightHlsSource(source, { fetch: (url, init) => fetch(url, init) });
  }

  stop(): void {
    this.playRequestGeneration += 1;
    this.sourceGeneration += 1;
    this.failedSourceGeneration = undefined;
    this.wantsPlayback = false;
    this.activeSource = undefined;
    this.parked = undefined;
    this.mediaTimeline = undefined;
    this.lastPublishedEvent = undefined;
    this.log.debug('stop', this.video ? videoState(this.video) : undefined);
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    this.initialSeekCleanup?.();
    this.initialSeekCleanup = undefined;
    const video = this.video;
    if (!video) return;
    this.subtitles.release(video);
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.parentNode?.removeChild(video);
    this.video = undefined;
  }

  subscribe(listener: (event: PlaybackEvent) => void): () => void {
    this.listeners.add(listener);
    // The unsubscribe is required, or listeners leak across generations.
    return () => this.listeners.delete(listener);
  }

  subscribeFailure(listener: (error: Error) => void): () => void {
    this.failureListeners.add(listener);
    return () => this.failureListeners.delete(listener);
  }

  /**
   * Bounds a source the element accepted and never got a byte from. Fails as
   * `'stream'` so the coordinator fails over; only a fresh `play()` re-runs
   * the media load algorithm.
   */
  private watchForStarvedStart(video: HTMLVideoElement, source: PlaybackSource, sourceGeneration: number): void {
    this.startWatchdog.start((visibleMs) => {
      if (sourceGeneration !== this.sourceGeneration || video !== this.video) return;
      const detail = {
        ...videoState(video),
        visibleMs,
        visibilityState: document.visibilityState,
        mode: source.mode,
        url: source.url,
      };
      this.log.error('source-start-starved', detail);
      this.failSourceGeneration(
        sourceGeneration,
        new PlaybackSourceError(`The stream delivered no data in ${Math.round(visibleMs / 1000)}s.`, 'stream'),
        detail,
      );
    });
  }

  /**
   * Bounds a generation whose picture has frozen with nothing arriving. Fails
   * as `'stream'` so the coordinator fails over. A native HLS player that
   * swallows the failure without raising `MediaError`, as this set's can, is
   * caught only here.
   */
  private watchForStall(video: HTMLVideoElement, source: PlaybackSource, sourceGeneration: number): void {
    // The stall budget belongs to the node serving this source. A node with a
    // longer hold than the default would otherwise be called dead at its own
    // frontier.
    this.stallWatchdog.useSourceBudgets(source);
    this.stallWatchdog.watch(({ visibleMs, positionMs, bufferedEndMs }) => {
      if (sourceGeneration !== this.sourceGeneration || video !== this.video) return;
      const detail = {
        ...videoState(video),
        visibleMs,
        stalledAtMs: Math.round(positionMs),
        // Absent stays absent: a player that cannot measure buffering is not
        // one whose buffer is at zero.
        bufferedEndMs: bufferedEndMs === undefined ? undefined : Math.round(bufferedEndMs),
        mode: source.mode,
        url: source.url,
      };
      this.log.error('source-stalled', detail);
      this.failSourceGeneration(
        sourceGeneration,
        new PlaybackSourceError(`Playback stopped and nothing arrived for ${Math.round(visibleMs / 1000)}s.`, 'stream'),
        detail,
      );
    });
  }

  /** One route for terminal evidence, so a watchdog and the element agree. */
  private failSourceGeneration(sourceGeneration: number, error: Error, detail?: unknown): void {
    if (sourceGeneration !== this.sourceGeneration || this.failedSourceGeneration === sourceGeneration) return;
    this.failedSourceGeneration = sourceGeneration;
    this.playRequestGeneration += 1;
    this.wantsPlayback = false;
    this.log.error('source-terminal-failure', { error, detail });
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    this.video?.pause();
    for (const listener of this.failureListeners) listener(error);
  }

  private publish(video: HTMLVideoElement): void {
    const timeline = this.mediaTimeline;
    if (!timeline || video !== this.video) return;

    const normalized = timeline.sample({
      positionMs: video.currentTime * 1000,
      bufferedRangesMs: playbackTimeRanges(video.buffered),
      seekableRangesMs: playbackTimeRanges(video.seekable),
    });
    // A reused element can emit events before the new generation establishes
    // its timestamp origin; those samples are dropped.
    if (!normalized) return;
    const bufferedRangesMs = normalized.bufferedRangesMs;

    // The watchdog needs both position and buffered end: a node producing
    // below realtime freezes the picture while the buffer fills, and that is
    // slow rather than dead.
    if (!video.paused) {
      const bufferedEndMs = bufferedRangesMs.reduce((end, range) => Math.max(end, range.endMs), 0);
      this.stallWatchdog.note(normalized.positionMs, bufferedEndMs);
    }

    const duration = Number.isFinite(video.duration) ? video.duration * 1000 : 0;
    const currentMs = normalized.positionMs;
    const event: PlaybackEvent = {
      // Whole milliseconds: this goes back to the node as `seekMs`, and the
      // seek contract is integer milliseconds.
      positionMs: Math.round(currentMs),
      // Floored: this is the scrubber's `max`, which a press at the far right
      // commits as a seek, so it must never claim media the element lacks.
      durationMs: Math.floor(duration),
      paused: video.paused,
      ended: video.ended,
      seeking: video.seeking,
      buffering: !video.paused
        && !video.ended
        && (video.seeking || video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA),
      bufferedRangesMs: wholeMillisecondRanges(bufferedRangesMs),
      forwardBufferMs: Math.round(forwardBufferMsAt(currentMs, bufferedRangesMs)),
    };
    if (playbackEventsEqual(this.lastPublishedEvent, event)) return;
    this.lastPublishedEvent = event;
    this.listeners.forEach((listener) => listener(event));
  }
}

/** What the element reports, for the log. */
function videoState(video: HTMLVideoElement): Record<string, unknown> {
  return {
    readyState: video.readyState,
    networkState: video.networkState,
    currentTimeMs: Math.round(video.currentTime * 1000),
    paused: video.paused,
    ended: video.ended,
    seeking: video.seeking,
    bufferedEndMs: video.buffered.length > 0 ? Math.round(video.buffered.end(video.buffered.length - 1) * 1000) : undefined,
    errorCode: video.error?.code,
  };
}

/** The element's `MediaError` as core's evidence: a code says what the bytes did. */
export function webMediaElementFailure(error: Pick<MediaError, 'code' | 'message'> | null): PlaybackSourceError {
  const code = error?.code;
  const detail = error?.message ? `: ${error.message}` : '';
  if (code === 2) return new PlaybackSourceError(`Web media network failure${detail}`, 'stream', error);
  if (code === 3) return new PlaybackSourceError(`Web media decode failure${detail}`, 'media', error);
  if (code === 4) return new PlaybackSourceError(`Web media source is unsupported${detail}`, 'unsupported', error);
  return new PlaybackSourceError(`Web media playback failure${detail}`, 'unknown', error);
}

function playbackTimeRanges(ranges: TimeRanges): PlaybackTimeRange[] {
  const out: PlaybackTimeRange[] = [];
  for (let index = 0; index < ranges.length; index += 1) {
    out.push({ startMs: ranges.start(index) * 1000, endMs: ranges.end(index) * 1000 });
  }
  return out;
}

/**
 * Ranges in whole milliseconds, widened: core admits a local seek against a
 * whole-millisecond target, and narrowing would refuse a seek the element can
 * serve, costing a generation negotiation.
 */
export function wholeMillisecondRanges(ranges: readonly PlaybackTimeRange[]): PlaybackTimeRange[] {
  return ranges.map((range) => ({ startMs: Math.floor(range.startMs), endMs: Math.ceil(range.endMs) }));
}

/**
 * Playable media ahead of a position. Only a range covering the position
 * counts, since the element stops at a hole; a range starting up to 250 ms
 * ahead is allowed, as element and ranges disagree slightly.
 */
export function forwardBufferMsAt(positionMs: number, ranges: readonly PlaybackTimeRange[]): number {
  let forwardMs = 0;
  for (const range of ranges) {
    if (range.startMs <= positionMs + 250 && range.endMs >= positionMs) {
      forwardMs = Math.max(forwardMs, range.endMs - positionMs);
    }
  }
  return forwardMs;
}

/** Whether two events say the same thing, so a flood of element events publishes once per change. */
export function playbackEventsEqual(previous: PlaybackEvent | undefined, next: PlaybackEvent): boolean {
  if (!previous
    || previous.positionMs !== next.positionMs
    || previous.durationMs !== next.durationMs
    || previous.paused !== next.paused
    || previous.ended !== next.ended
    || previous.seeking !== next.seeking
    || previous.buffering !== next.buffering
    || previous.forwardBufferMs !== next.forwardBufferMs) return false;
  const previousRanges = previous.bufferedRangesMs ?? [];
  const nextRanges = next.bufferedRangesMs ?? [];
  if (previousRanges.length !== nextRanges.length) return false;
  for (let index = 0; index < previousRanges.length; index += 1) {
    if (previousRanges[index]!.startMs !== nextRanges[index]!.startMs
      || previousRanges[index]!.endMs !== nextRanges[index]!.endMs) return false;
  }
  return true;
}
