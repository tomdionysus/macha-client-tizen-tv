import { useEffect, useMemo, useRef, useState } from 'react';
import { trackLiveSession } from '../state/liveSessions';
import { PageExit } from './pageExit';
import {
  PlaybackRuntime,
  type PlaybackHost,
  type PlaybackResolver,
  type PlaybackRuntimeOptions,
  type PlaybackRuntimeRequest,
  type Platform,
} from '@machafoundation/core';

/** What the host does around the close on `hidden`. */
export interface PageExitHandlers {
  /** Before the session closes, while its position can still be read. */
  onExit(): void;
  /** On the return to `visible`, with the playback the close ended. */
  onReturn(request: PlaybackRuntimeRequest): void;
}

/**
 * The application-scoped playback runtime. `PlaybackRuntime` wraps
 * `PlaybackCoordinator`, which owns failover and stall recovery; never drive
 * `ClusterPlaybackResolver` directly.
 */
export function usePlaybackRuntime(
  platform: Platform,
  resolver: PlaybackResolver,
  options?: PlaybackRuntimeOptions,
  pageExitHandlers?: PageExitHandlers,
) {
  // Keyed only by platform: replacing the runtime on a resolver change would
  // drop an active generation's presentation host.
  const runtime = useMemo(() => new PlaybackRuntime(platform, resolver, options), [platform]);
  const [state, setState] = useState(() => runtime.getSnapshot());

  useEffect(() => runtime.subscribeLifecycle(setState), [runtime]);

  // Record the live session durably (`state/liveSessions.ts`), at app scope
  // so it outlives the player screen.
  useEffect(
    () => runtime.subscribePlayback((snapshot) => trackLiveSession(snapshot?.session?.sessionId)),
    [runtime],
  );
  useEffect(() => {
    runtime.setResolver(resolver);
  }, [resolver, runtime]);
  useEffect(() => () => void runtime.dispose(), [runtime]);

  const handlers = useRef(pageExitHandlers);
  handlers.current = pageExitHandlers;

  // Close the session when the set hides the application (standby, another
  // app), or the node keeps its transcode slot and the next viewer gets a 429.
  // The set suspends a widget without firing `pagehide`, so visibility is the
  // signal; `pagehide` covers a plain unload.
  useEffect(() => {
    const exit = new PageExit();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (exit.background(runtime.getSnapshot())) handlers.current?.onExit();
        runtime.terminateForPageExit();
      } else {
        const closed = exit.active();
        if (closed) handlers.current?.onReturn(closed);
      }
    };
    const onPageHide = () => runtime.terminateForPageExit();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [runtime]);

  return { runtime, state };
}

/**
 * Bind a presentation surface: the element the player puts its `<video>` in.
 * Core compares hosts by identity and carries them as `unknown`.
 */
export function attachPlaybackHost(runtime: PlaybackRuntime, host: PlaybackHost): () => void {
  runtime.attach(host);
  return () => runtime.detach(host);
}
