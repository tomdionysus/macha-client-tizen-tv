import { describe, expect, it } from 'vitest';
import type { PlaybackEvent } from '@machafoundation/core';
import { TizenPlatform } from '../platform/TizenPlatform';
import {
  forwardBufferMsAt,
  playbackEventsEqual,
  TizenVideoPlayer,
  webMediaElementFailure,
  wholeMillisecondRanges,
} from './TizenVideoPlayer';

describe('what this set is asked for', () => {
  it('is MPEG-TS and never a whole file: every HLS fault here is fMP4', () => {
    const policy = new TizenPlatform().playbackPolicy;
    expect(policy.preferSegmentContainer).toBe('mpegts');
    expect(policy.neverDirect).toBe(true);
  });

  it('has core hold a source until the node has produced it, which native HLS cannot ride out', () => {
    expect(new TizenVideoPlayer().needsProducedSource).toBe(true);
  });
});

describe('the media element as evidence', () => {
  it('reads each code as what the bytes did', () => {
    expect(webMediaElementFailure({ code: 2, message: '' }).kind).toBe('stream');
    expect(webMediaElementFailure({ code: 3, message: '' }).kind).toBe('media');
    expect(webMediaElementFailure({ code: 4, message: '' }).kind).toBe('unsupported');
    expect(webMediaElementFailure(null).kind).toBe('unknown');
  });
});

describe('buffered ranges', () => {
  it('counts only the range covering the position, since the element stops at a hole', () => {
    const ranges = [{ startMs: 0, endMs: 5_000 }, { startMs: 20_000, endMs: 40_000 }];
    expect(forwardBufferMsAt(1_000, ranges)).toBe(4_000);
    expect(forwardBufferMsAt(10_000, ranges)).toBe(0);
  });

  it('widens to whole milliseconds, so a servable local seek is not refused', () => {
    expect(wholeMillisecondRanges([{ startMs: 10.4, endMs: 20.2 }])).toEqual([{ startMs: 10, endMs: 21 }]);
  });
});

describe('publishing once per change', () => {
  const event: PlaybackEvent = {
    positionMs: 1,
    durationMs: 2,
    paused: false,
    ended: false,
    seeking: false,
    buffering: false,
    bufferedRangesMs: [{ startMs: 0, endMs: 2 }],
    forwardBufferMs: 1,
  };

  it('treats an identical event as no change, and a first event as one', () => {
    expect(playbackEventsEqual(event, { ...event })).toBe(true);
    expect(playbackEventsEqual(undefined, event)).toBe(false);
  });

  it('sees a change of position or of a range', () => {
    expect(playbackEventsEqual(event, { ...event, positionMs: 9 })).toBe(false);
    expect(playbackEventsEqual(event, { ...event, bufferedRangesMs: [{ startMs: 0, endMs: 3 }] })).toBe(false);
  });
});
