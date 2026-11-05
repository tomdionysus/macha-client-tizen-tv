import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  configureMachaHost,
  seedEndpoints,
  createMachaServices,
  EndpointHealthMonitor,
  EndpointRegistry,
  sessionManager,
  ContinueWatchingStore,
  PlaybackQueueStore,
  type MachaServices,
} from '@machafoundation/core';
import {
  clientConfiguration,
  getBootstrapEndpoints,
  getClientId,
  getDiscoveredEndpoints,
} from '../state/client';
import { nativeStorage } from '../state/storage';

/**
 * Core, brought up once. `configureMachaHost` must run before any service is
 * constructed: singletons such as `sessionManager` read the host on first use
 * and keep what they found.
 */
export interface Macha {
  services: MachaServices;
  registry: EndpointRegistry;
  continueWatching: ContinueWatchingStore;
  queue: PlaybackQueueStore;
  /** False only while a cold-start token mint is genuinely in flight. */
  sessionReady: boolean;
}

const MachaContext = createContext<Macha | undefined>(undefined);

export function useMacha(): Macha {
  const macha = useContext(MachaContext);
  if (!macha) throw new Error('useMacha called outside MachaProvider');
  return macha;
}

/**
 * Called at module scope, not in an effect: the first render already
 * constructs services.
 */
let hostConfigured = false;
export function configureHost(): void {
  if (hostConfigured) return;
  hostConfigured = true;
  configureMachaHost({
    storage: nativeStorage,
    // Relative artwork and stream URLs resolve against the node, not the
    // widget's `file://` page.
    origin: clientConfiguration.serverUrl(),
    // Only an https page blocks http nodes. The widget's page is `file://`,
    // where `isSecureContext` is true and plain http is fetched freely.
    secureContext: false,
  });
}

export function MachaProvider({ children }: { children: ReactNode }): React.JSX.Element {
  configureHost();

  const registry = useMemo(
    () => new EndpointRegistry(seedEndpoints({ configured: getBootstrapEndpoints(), remembered: getDiscoveredEndpoints() })),
    [],
  );

  // Never rebuilt mid-playback: that orphans the active generation's node
  // ownership. Services authenticate through `auth` at request time.
  const services = useMemo(
    () => createMachaServices({ endpointRegistry: registry, auth: sessionManager }),
    [registry],
  );

  // Scoped to the client id, so two sets on one cluster keep separate state.
  const stores = useMemo(() => {
    const clientId = getClientId();
    return {
      continueWatching: new ContinueWatchingStore(clientId),
      queue: new PlaybackQueueStore(clientId),
    };
  }, []);

  const [sessionReady, setSessionReady] = useState(sessionManager.isReady);

  useEffect(() => sessionManager.subscribe(() => setSessionReady(sessionManager.isReady)), []);

  useEffect(() => {
    sessionManager.start(registry);
    return () => sessionManager.stop();
  }, [registry]);

  useEffect(() => {
    const health = new EndpointHealthMonitor({
      registry,
      clusterStatusApi: services.clusterStatusApi,
      auth: sessionManager,
      configuration: clientConfiguration,
    });
    health.start();
    return () => health.stop();
  }, [registry, services]);

  // Back from standby: the session may have lapsed while the set was off.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sessionManager.start(registry);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [registry]);

  const value = useMemo<Macha>(
    () => ({ services, registry, ...stores, sessionReady }),
    [services, registry, stores, sessionReady],
  );

  return <MachaContext.Provider value={value}>{children}</MachaContext.Provider>;
}
