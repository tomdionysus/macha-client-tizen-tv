export interface EndpointChangeSteps {
  /** Core's `sessionManager.signOut`: clears the token locally, then revokes it. */
  signOut(): Promise<void>;
  /** Forgets the nodes the previous cluster advertised. */
  forgetDiscovered(): void;
  save(urls: readonly string[]): void;
  /** Resolves once storage writes have reached the device. */
  flush(): Promise<unknown>;
  restart(): void;
}

function sameEndpoints(a: readonly string[], b: readonly string[]): boolean {
  const key = (urls: readonly string[]) =>
    urls.map((url) => url.trim().replace(/\/+$/, '').toLowerCase()).sort().join('\n');
  return key(a) === key(b);
}

/**
 * Points the client at a new endpoint list and restarts it, because the
 * registry is built from that list at startup. A changed list ends the old
 * session first, while the registry can still reach the cluster that issued
 * it: a session cannot move between clusters, and one left cached is offered
 * to the new cluster at the next start. A failed revoke does not stop the
 * change; core has already cleared the token locally.
 */
export async function changeEndpoints(
  current: readonly string[],
  next: readonly string[],
  steps: EndpointChangeSteps,
): Promise<void> {
  if (!sameEndpoints(current, next)) {
    try {
      await steps.signOut();
    } catch {
      // Cleared locally regardless; the old cluster may be the one that is gone.
    }
    steps.forgetDiscovered();
  }
  steps.save(next);
  await restartAfterFlush(steps);
}

/** Restarts once storage writes have landed, so the next start reads them. */
export async function restartAfterFlush(steps: Pick<EndpointChangeSteps, 'flush' | 'restart'>): Promise<void> {
  try {
    await steps.flush();
  } finally {
    steps.restart();
  }
}
