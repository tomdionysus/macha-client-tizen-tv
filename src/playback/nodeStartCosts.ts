import type { PlaybackResolver } from '@machafoundation/core';

/**
 * What it costs each node to start a stream, as this viewer measures it: session create to first
 * fragment. Only the latest figure counts, and only while fresh. Keyed by origin, which a session
 * URL and an endpoint share.
 */

/** Past this a measurement describes the node as it was, not as it is. */
export const START_COST_STALE_MS = 10 * 60_000;
/** A session whose first fragment never came is not waited on forever. */
const PENDING_LIMIT_MS = 5 * 60_000;

export interface NodeStartCost {
  costMs: number;
  ageMs: number;
}

function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export class NodeStartCosts {
  private readonly pending = new Map<string, number>();
  private readonly measured = new Map<string, { costMs: number; atMs: number }>();

  /** One clock for both ends, so a span is never taken across two. */
  constructor(readonly now: () => number) {}

  /** A session for this source URL was asked for at `startedAtMs`. */
  requested(sourceUrl: string, startedAtMs: number): void {
    const now = this.now();
    for (const [url, at] of this.pending) if (now - at > PENDING_LIMIT_MS) this.pending.delete(url);
    this.pending.set(sourceUrl, startedAtMs);
  }

  /** Call on a source's first media fragment. Returns the measurement if this call made it. */
  firstFragment(sourceUrl: string): number | undefined {
    const startedAtMs = this.pending.get(sourceUrl);
    if (startedAtMs === undefined) return undefined;
    this.pending.delete(sourceUrl);
    const origin = originOf(sourceUrl);
    if (!origin) return undefined;
    const now = this.now();
    const costMs = Math.round(now - startedAtMs);
    this.measured.set(origin, { costMs, atMs: now });
    return costMs;
  }

  /** The freshest measurement across a node's addresses, or nothing. */
  forNode(baseUrls: readonly string[]): NodeStartCost | undefined {
    const now = this.now();
    let freshest: { costMs: number; atMs: number } | undefined;
    for (const baseUrl of baseUrls) {
      const origin = originOf(baseUrl);
      const entry = origin ? this.measured.get(origin) : undefined;
      if (entry && (!freshest || entry.atMs > freshest.atMs)) freshest = entry;
    }
    if (!freshest || now - freshest.atMs > START_COST_STALE_MS) return undefined;
    return { costMs: freshest.costMs, ageMs: Math.round(now - freshest.atMs) };
  }
}

/** Shared by the resolver wrapper and the player, which see the two ends. */
export const nodeStartCosts = new NodeStartCosts(() => performance.now());

function sessionSourceUrl(value: unknown): string | undefined {
  const url = (value as { source?: { url?: unknown } } | undefined)?.source?.url;
  return typeof url === 'string' ? url : undefined;
}

/**
 * Wraps the resolver so every call resolving to a session is timed. Every method found on it is
 * wrapped, so a method core adds is measured too, and an absent optional method stays absent, which
 * core branches on. Everything else is inherited from the resolver, so its fields read live.
 * Not a Proxy: a Tizen 3 television's Chromium 47 has none, and none can be polyfilled.
 */
export function measureStartCosts(resolver: PlaybackResolver, costs: NodeStartCosts = nodeStartCosts): PlaybackResolver {
  const measured = Object.create(resolver) as PlaybackResolver;
  for (let owner: object | null = resolver; owner && owner !== Object.prototype; owner = Object.getPrototypeOf(owner) as object | null) {
    for (const name of Object.getOwnPropertyNames(owner)) {
      const value: unknown = Object.getOwnPropertyDescriptor(owner, name)?.value;
      if (name === 'constructor' || typeof value !== 'function' || Object.prototype.hasOwnProperty.call(measured, name)) continue;
      const method = value as (...args: unknown[]) => unknown;
      Object.defineProperty(measured, name, {
        value: (...args: unknown[]) => {
          const startedAtMs = costs.now();
          const result = method.apply(resolver, args);
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            void (result as Promise<unknown>).then((resolved) => {
              const url = sessionSourceUrl(resolved);
              if (url) costs.requested(url, startedAtMs);
            }, () => undefined);
          }
          return result;
        },
      });
    }
  }
  return measured;
}
