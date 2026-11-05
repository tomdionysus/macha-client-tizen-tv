import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ArtworkRef, MediaApi } from '@machafoundation/core';
import { Image, type Style } from './primitives';
import { artworkSources, forgetArtworkUrl, rememberArtworkUrl } from './artworkSources';

/**
 * Artwork that falls back to another node when one refuses it, and does not
 * re-download on every catalogue refresh.
 *
 * When every URL an `<img>` can use has been refused, core fetches it with the
 * session's token. That is the ordinary case for Continue Watching: an entry
 * keeps the signed URL it was saved with, and once that expires every node
 * answers 401 (measured on the set), leaving only URLs that need a header.
 */

export function LazyArtwork({
  api,
  artwork,
  style,
  resizeMode = 'cover',
}: {
  api: MediaApi;
  artwork?: ArtworkRef;
  style?: Style;
  resizeMode?: 'cover' | 'contain';
}): React.JSX.Element | null {
  const sources = useMemo(
    () => (artwork ? artworkSources(api, artwork) : []),
    // Keyed on the id: `artwork.url` changes on every re-sign and must not
    // rebuild the plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, artwork?.id],
  );
  const [index, setIndex] = useState(0);
  const [fetched, setFetched] = useState<string>();

  const url = sources[index];
  const exhausted = Boolean(artwork) && url === undefined;

  useEffect(() => {
    if (!exhausted || !artwork) return undefined;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    api.artwork(artwork, controller.signal).then(
      (blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setFetched(objectUrl);
      },
      () => {
        // Every node refused; the card's background is the placeholder.
      },
    );
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setFetched(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as `sources`: keyed on the id.
  }, [api, artwork?.id, exhausted]);

  const onError = useCallback(() => {
    if (!artwork) return;
    // Forget a URL that failed, or it stays first in the plan.
    if (url) forgetArtworkUrl(artwork.id, url);
    setIndex((current) => current + 1);
  }, [artwork, url]);

  const onLoad = useCallback(() => {
    if (artwork && url) rememberArtworkUrl(artwork.id, url);
  }, [artwork, url]);

  if (fetched) return <Image source={fetched} style={style} resizeMode={resizeMode} />;
  if (!url) return null;

  return (
    <Image
      // Keyed by URL so moving to the next node remounts the image.
      key={url}
      source={url}
      style={style}
      resizeMode={resizeMode}
      onError={onError}
      onLoad={onLoad}
    />
  );
}
