import type { createClientLogger } from '@machafoundation/core';
import {
  isLegacyWebVtt,
  subtitleSegmentAt,
  subtitleSegmentStarts,
  subtitleSegmentWindow,
  validSubtitleManifest,
  type SubtitleSegmentManifest,
} from '../platform/WebSubtitles';

/**
 * Subtitles on a media element: a whole WebVTT file as a `<track>`, or the
 * server's segmented manifest, whose segments are fetched around the
 * position and copied into one display track. Listeners are removed by
 * hand rather than with `{ once: true }`, which Tizen's `addEventListener`
 * ignores.
 */

function clearTextTrackCues(track: TextTrack): void {
  // `cues` is null while disabled; hidden exposes them without rendering.
  track.mode = 'hidden';
  const cues = track.cues;
  if (cues) {
    for (let index = cues.length - 1; index >= 0; index -= 1) {
      const cue = cues[index];
      if (cue) track.removeCue(cue);
    }
  }
  track.mode = 'disabled';
}

function cloneWebVttCue(cue: TextTrackCue): VTTCue | undefined {
  if (typeof VTTCue === 'undefined' || !(cue instanceof VTTCue)) return undefined;
  const clone = new VTTCue(cue.startTime, cue.endTime, cue.text);
  clone.id = cue.id;
  return clone;
}

export class VideoSubtitles {
  private generation = 0;
  private cleanup?: () => void;
  private displayTrack?: TextTrack;

  constructor(private readonly log: ReturnType<typeof createClientLogger>) {}

  /** Replace whatever is showing with `url`, or nothing. */
  async apply(video: HTMLVideoElement, subtitleUrl?: string): Promise<void> {
    const generation = this.clear(video);
    if (!subtitleUrl) return;

    // A monolithic VTT rather than a segment manifest gets a plain track.
    if (isLegacyWebVtt(subtitleUrl)) {
      await this.loadTrack(video, subtitleUrl, generation);
      return;
    }

    let response: Response;
    try {
      response = await fetch(subtitleUrl, { headers: { Accept: 'application/json' } });
    } catch (error) {
      this.log.warn('subtitle-manifest-fetch-failed', { url: subtitleUrl, error });
      throw new Error('Selected subtitles could not be loaded.');
    }
    if (!response.ok) {
      this.log.warn('subtitle-manifest-http-error', { url: subtitleUrl, status: response.status });
      throw new Error(`Selected subtitles could not be loaded (${response.status}).`);
    }

    let manifest: unknown;
    try {
      manifest = await response.json() as unknown;
    } catch (error) {
      this.log.warn('subtitle-manifest-json-error', { url: subtitleUrl, error });
      throw new Error('Server returned an invalid subtitle manifest.');
    }
    if (!validSubtitleManifest(manifest)) {
      this.log.warn('subtitle-manifest-invalid', { url: subtitleUrl, manifest });
      throw new Error('Server returned an invalid subtitle manifest.');
    }
    if (generation !== this.generation) return;
    this.log.debug('subtitle-manifest-loaded', {
      url: subtitleUrl,
      streamIndex: manifest.stream_index,
      segments: manifest.segment_durations_ms.length,
    });
    await this.applySegmented(video, subtitleUrl, manifest, generation);
  }

  /** Remove every track and cue; answers the generation a later load must still match. */
  clear(video: HTMLVideoElement): number {
    const generation = ++this.generation;
    this.cleanup?.();
    this.cleanup = undefined;
    video.querySelectorAll('track[data-macha-subtitle]').forEach((track) => track.parentNode?.removeChild(track));
    if (this.displayTrack) clearTextTrackCues(this.displayTrack);
    return generation;
  }

  /** The element is going: forget the display track that belonged to it. */
  release(video: HTMLVideoElement): void {
    this.clear(video);
    this.displayTrack = undefined;
  }

  private loadTrack(video: HTMLVideoElement, url: string, generation: number): Promise<void> {
    const track = document.createElement('track');
    track.dataset.machaSubtitle = 'true';
    track.kind = 'subtitles';
    track.label = 'Selected subtitles';
    track.srclang = 'und';
    track.src = url;
    return new Promise<void>((resolve, reject) => {
      const detach = () => {
        track.removeEventListener('load', onLoad);
        track.removeEventListener('error', onError);
      };
      const onLoad = () => {
        detach();
        if (generation !== this.generation) {
          track.remove();
          resolve();
          return;
        }
        track.track.mode = 'showing';
        this.log.debug('subtitle-loaded', { url });
        resolve();
      };
      const onError = () => {
        detach();
        track.remove();
        this.log.warn('subtitle-error', { url });
        reject(new Error('Selected subtitles could not be loaded.'));
      };
      track.addEventListener('load', onLoad);
      track.addEventListener('error', onError);
      video.appendChild(track);
      // A disabled TextTrack need not fetch: hidden loads it, and the load
      // handler shows it once parsed.
      track.track.mode = 'hidden';
    });
  }

  private display(video: HTMLVideoElement): TextTrack {
    if (!this.displayTrack) {
      this.displayTrack = video.addTextTrack('subtitles', 'Selected subtitles', 'und');
    }
    clearTextTrackCues(this.displayTrack);
    this.displayTrack.mode = 'showing';
    return this.displayTrack;
  }

  private async applySegmented(
    video: HTMLVideoElement,
    manifestUrl: string,
    manifest: SubtitleSegmentManifest,
    generation: number,
  ): Promise<void> {
    const starts = subtitleSegmentStarts(manifest.segment_durations_ms);
    const segmentAt = (positionMs: number): number => subtitleSegmentAt(starts, positionMs);

    const displayTrack = this.display(video);
    const segmentCues = new Map<number, TextTrackCue[]>();
    const loading = new Map<number, Promise<void>>();
    const wanted = new Set<number>();
    const segmentUrl = (index: number) => new URL(`segment-${index}.vtt`, manifestUrl).toString();

    const unload = (index: number): void => {
      const cues = segmentCues.get(index);
      if (!cues) return;
      // Keep the display track active while its cue list is edited.
      displayTrack.mode = 'showing';
      for (const cue of cues) {
        try {
          displayTrack.removeCue(cue);
        } catch {
          // A cancelled generation may already have cleared this cue.
        }
      }
      segmentCues.delete(index);
    };

    const parseSegment = (index: number, text: string): Promise<TextTrackCue[]> => new Promise((resolve, reject) => {
      const parser = document.createElement('track');
      // Not marked as an active subtitle track: a concurrent selection clears
      // those, and this parser must finish so its promise settles.
      parser.dataset.machaSubtitleParser = String(index);
      parser.kind = 'subtitles';
      parser.label = `Subtitle parser ${index}`;
      parser.srclang = 'und';
      const blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
      parser.src = blobUrl;

      const finish = () => {
        parser.removeEventListener('load', onLoad);
        parser.removeEventListener('error', onError);
        parser.remove();
        URL.revokeObjectURL(blobUrl);
      };
      const onLoad = () => {
        const parsed: TextTrackCue[] = [];
        const cues = parser.track.cues;
        if (cues) {
          for (let cueIndex = 0; cueIndex < cues.length; cueIndex += 1) {
            const cue = cues[cueIndex];
            if (!cue) continue;
            const clone = cloneWebVttCue(cue);
            if (clone) parsed.push(clone);
          }
        }
        finish();
        resolve(parsed);
      };
      const onError = () => {
        finish();
        reject(new Error('Browser could not parse a subtitle segment.'));
      };
      parser.addEventListener('load', onLoad);
      parser.addEventListener('error', onError);
      video.appendChild(parser);
      // Hidden runs the WebVTT parser without rendering; the cues are copied
      // into the display track.
      parser.track.mode = 'hidden';
    });

    const load = (index: number): Promise<void> => {
      if (index < 0 || index >= starts.length || generation !== this.generation) return Promise.resolve();
      if (segmentCues.has(index)) return Promise.resolve();
      const existing = loading.get(index);
      if (existing) return existing;

      const url = segmentUrl(index);
      const promise = (async () => {
        let response: Response;
        try {
          response = await fetch(url, { headers: { Accept: 'text/vtt' } });
        } catch (error) {
          this.log.warn('subtitle-segment-fetch-failed', { index, url, error });
          throw new Error('Selected subtitles could not be loaded.');
        }
        if (!response.ok) {
          this.log.warn('subtitle-segment-http-error', { index, url, status: response.status });
          throw new Error(`Selected subtitles could not be loaded (${response.status}).`);
        }
        const text = await response.text();
        if (generation !== this.generation || !wanted.has(index)) return;

        let cues: TextTrackCue[];
        try {
          cues = await parseSegment(index, text);
        } catch (error) {
          this.log.warn('subtitle-segment-parse-error', { index, url, error });
          throw new Error('Selected subtitles could not be loaded.');
        }
        if (generation !== this.generation || !wanted.has(index)) return;

        for (const cue of cues) displayTrack.addCue(cue);
        segmentCues.set(index, cues);
        this.log.debug('subtitle-segment-loaded', { index, url, cues: cues.length });
      })().finally(() => {
        loading.delete(index);
      });
      loading.set(index, promise);
      return promise;
    };

    const refresh = () => {
      if (generation !== this.generation) return;
      const current = segmentAt(video.currentTime * 1000);
      wanted.clear();
      // The window keeps the preceding segment, for a cue that crosses the
      // boundary, and prefetches the next.
      for (const index of subtitleSegmentWindow(current, starts.length)) {
        wanted.add(index);
        void load(index).catch(() => undefined);
      }
      for (const index of [...segmentCues.keys()]) {
        if (!wanted.has(index)) unload(index);
      }
    };

    const events = ['loadedmetadata', 'timeupdate', 'seeking', 'seeked'] as const;
    for (const event of events) video.addEventListener(event, refresh);
    this.cleanup = () => {
      for (const event of events) video.removeEventListener(event, refresh);
      wanted.clear();
      for (const index of [...segmentCues.keys()]) unload(index);
      loading.clear();
      clearTextTrackCues(displayTrack);
    };

    // Prime the window, then await the current segment; repeat once if
    // playback moved meanwhile.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      refresh();
      const current = segmentAt(video.currentTime * 1000);
      await load(current);
      if (generation !== this.generation) return;
      if (segmentAt(video.currentTime * 1000) === current) break;
    }
    refresh();
  }
}
