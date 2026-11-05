import { useRef } from 'react';
import { ScrollView, Text, type Style } from '../components/primitives';
import type { Episode, MediaApi, MediaSummary, SeasonDetails, ShowDetails } from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaRow } from '../components/MediaRow';
import { firstAvailableIndex } from '../components/availability';
import { EpisodeCard } from '../components/EpisodeCard';
import { colour, layout, lineHeightPx, pageGutter, rem, type } from '../styles/theme';

/** A show and its seasons, from `.series-content` in the web client. */
export function SeriesScreen({
  api,
  show,
  onOpenSeason,
}: {
  api: MediaApi;
  show: MediaSummary;
  onOpenSeason: (season: MediaSummary) => void;
}): React.JSX.Element {
  const details = useRefreshableAsync(() => api.details(show.id), [api, show.id]);
  const seasons = (details.value as ShowDetails | undefined)?.seasons ?? [];
  // The route's summary may be only an id and a title, so the fetched show wins.
  const shown = details.value ?? show;

  return (
    <ScrollView contentStyle={styles.page}>
      <PageTitle media={shown}>{shown.title}</PageTitle>
      {shown.synopsis ? (
        <Text style={styles.synopsis} numberOfLines={3}>
          {shown.synopsis}
        </Text>
      ) : null}
      {details.error ? (
        details.value ? <RefreshError error={details.error} /> : <ErrorMessage error={details.error} />
      ) : null}
      {!details.value && details.loading ? <Loading /> : null}
      <MediaRow title="Seasons" items={seasons} onSelect={onOpenSeason} defaultFocusFirst addressable />
    </ScrollView>
  );
}

/** One season's episodes, from `.episode-rail`. */
export function SeasonScreen({
  api,
  season,
  onPlayEpisode,
  progressFor,
}: {
  api: MediaApi;
  season: MediaSummary;
  onPlayEpisode: (episode: Episode) => void;
  progressFor?: (mediaId: string) => number | undefined;
}): React.JSX.Element {
  const details = useRefreshableAsync(() => api.details(season.id), [api, season.id]);
  const episodes = (details.value as SeasonDetails | undefined)?.episodes ?? [];
  const firstFocus = firstAvailableIndex(episodes);
  const scroller = useRef<HTMLDivElement | null>(null);

  const scrollToIndex = (index: number) => {
    const stride = layout.episodeCardWidth + layout.episodeRailGap;
    const view = scroller.current;
    if (view) view.scrollLeft = Math.max(0, index * stride - stride);
  };

  return (
    <ScrollView contentStyle={styles.page}>
      <PageTitle media={details.value ?? season}>{season.title}</PageTitle>
      {details.error ? (
        details.value ? <RefreshError error={details.error} /> : <ErrorMessage error={details.error} />
      ) : null}
      {!details.value && details.loading ? <Loading /> : null}

      <ScrollView ref={scroller} horizontal contentStyle={styles.rail}>
        {episodes.map((episode, index) => (
          <EpisodeCard
            key={episode.id}
            episode={episode}
            onSelect={() => onPlayEpisode(episode)}
            defaultFocus={index === firstFocus}
            progress={progressFor?.(episode.id)}
            onFocusChange={(focused) => focused && scrollToIndex(index)}
            style={index > 0 ? styles.episodeAfterFirst : undefined}
          />
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = {
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  synopsis: {
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    maxWidth: rem(56),
    color: colour.bodyBright,
    fontSize: type.synopsis,
    lineHeight: lineHeightPx(type.synopsis * 1.65),
  },
  // `.episode-rail { gap: 1.15rem; padding: .65rem 3vw 1.6rem .2rem }`
  rail: {
    paddingTop: rem(0.65),
    paddingBottom: rem(1.6),
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
  },
  episodeAfterFirst: {
    marginLeft: layout.episodeRailGap,
  },
} satisfies Record<string, Style>;
