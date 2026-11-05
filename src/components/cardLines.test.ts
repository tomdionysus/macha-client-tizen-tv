import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '@machafoundation/core';
import { cardLines, contextLinks, linkStep } from './cardLines';

const music = { album: { id: 'al', title: 'Harbourlight', year: 1997 }, artist: { id: 'ar', title: 'Bjarnö' } };

describe('cardLines', () => {
  it('names an episode by its series, then S01E03, in every context', () => {
    const episode: MediaSummary = {
      id: 'e', kind: 'episode', title: 'Our Mrs. Halloran', mediaIds: [], seasonNumber: 1, episodeNumber: 3,
      playbackContext: { series: { id: 's', title: 'Lanternfly' }, season: { id: 'x', title: 'Season 1', seasonNumber: 1 } },
    };
    expect(cardLines(episode)).toEqual(['Lanternfly', 'S01E03']);
  });

  it('gives a search track "Artist - Album (year)", then its own position', () => {
    const track = { id: 't', kind: 'track', title: 'Jóla', mediaIds: [], trackNumber: 3, musicContext: music } as MediaSummary;
    expect(cardLines(track)).toEqual(['Bjarnö - Harbourlight (1997)', 'Track 3']);
  });

  it("puts an album's artist beneath it", () => {
    const album = { id: 'al', kind: 'album', title: 'Harbourlight', mediaIds: [], musicContext: music } as MediaSummary;
    expect(cardLines(album)).toEqual(['Bjarnö']);
  });

  it('gives a film its year', () => {
    expect(cardLines({ id: 'f', kind: 'movie', title: 'Landfall', mediaIds: [], year: 2016 })).toEqual(['2016']);
  });
});

describe('contextLinks', () => {
  const context = { series: { id: 's', title: 'Lanternfly' }, season: { id: 'x', title: 'Season 1', seasonNumber: 1 } };

  it("links an episode's series, then its season under the episode mark, as the web client does", () => {
    const episode: MediaSummary = { id: 'e', kind: 'episode', title: 'Our Mrs. Halloran', mediaIds: [], seasonNumber: 1, episodeNumber: 3, playbackContext: context };
    const links = contextLinks(episode);
    expect(links?.map((link) => link.label)).toEqual(['Lanternfly', 'S01E03']);
    expect(links?.[0]?.target).toMatchObject({ id: 's', kind: 'show', title: 'Lanternfly' });
    // The season knows its show, so opening it puts it on the show's trail.
    expect(links?.[1]?.target).toMatchObject({ id: 'x', kind: 'season', title: 'Season 1', parentId: 's' });
  });

  it('labels the season link by the season when the episode has no number', () => {
    const episode: MediaSummary = { id: 'e', kind: 'episode', title: 'Pilot', mediaIds: [], playbackContext: { ...context, season: { id: 'x', title: '', seasonNumber: 2 } } };
    expect(contextLinks(episode)?.[1]?.label).toBe('Season 2');
  });

  it('has none for an episode without its hierarchy, or anything that is not an episode', () => {
    expect(contextLinks({ id: 'e', kind: 'episode', title: 'Pilot', mediaIds: [] })).toBeUndefined();
    expect(contextLinks({ id: 'm', kind: 'movie', title: 'Stillwater', mediaIds: [] })).toBeUndefined();
    expect(contextLinks({ id: 't', kind: 'track', title: 'Jola', mediaIds: [], musicContext: music } as MediaSummary)).toBeUndefined();
  });
});

describe('linkStep', () => {
  it('walks down from the card through each link, and back up to the card', () => {
    expect(linkStep('card', 'down', 2)).toBe(0);
    expect(linkStep(0, 'down', 2)).toBe(1);
    expect(linkStep(1, 'up', 2)).toBe(0);
    expect(linkStep(0, 'up', 2)).toBe('card');
  });

  it('leaves Down from the last link, and every sideways move, to the scorer', () => {
    expect(linkStep(1, 'down', 2)).toBeUndefined();
    expect(linkStep(0, 'left', 2)).toBeUndefined();
    expect(linkStep('card', 'right', 2)).toBeUndefined();
    expect(linkStep('card', 'up', 2)).toBeUndefined();
  });
});
