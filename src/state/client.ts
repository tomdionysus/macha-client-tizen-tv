import { MachaClientConfiguration, parseEndpointList } from '@machafoundation/core';
import { nativeStorage } from './storage';

/**
 * Binds core's `MachaClientConfiguration` to the build's environment
 * (`.env.samsung`). Endpoints are not pinned: a viewer's server set in
 * Settings survives an app update, as on the Android TV client.
 */
export const clientConfiguration = new MachaClientConfiguration({
  // Precedence lives in core. A `.env` unsets a variable by defining it empty, which an `??` here would not fall through.
  environmentEndpoints: parseEndpointList(
    import.meta.env.VITE_MACHA_SERVERS as string | undefined,
    import.meta.env.VITE_MACHA_SERVER as string | undefined,
  ),
  pinnedEndpoints: false,
  storage: nativeStorage,
});

export function getClientId(): string {
  return clientConfiguration.clientId();
}

export function getBootstrapEndpoints(): string[] {
  return clientConfiguration.bootstrapEndpoints();
}

export function setBootstrapEndpoints(urls: readonly string[]): void {
  clientConfiguration.setBootstrapEndpoints(urls);
}

export function getDiscoveredEndpoints(): string[] {
  return clientConfiguration.discoveredEndpoints();
}

export function setDiscoveredEndpoints(urls: readonly string[]): void {
  clientConfiguration.setDiscoveredEndpoints(urls);
}
