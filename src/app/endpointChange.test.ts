import { describe, expect, it } from 'vitest';
import { changeEndpoints, restartAfterFlush, type EndpointChangeSteps } from './endpointChange';

function recorder(options: { signOutFails?: boolean } = {}) {
  const calls: string[] = [];
  const steps: EndpointChangeSteps = {
    signOut: async () => {
      calls.push('signOut');
      if (options.signOutFails) throw new Error('revoke failed');
    },
    forgetDiscovered: () => calls.push('forgetDiscovered'),
    save: (urls) => calls.push(`save ${urls.join(',')}`),
    flush: async () => {
      calls.push('flush');
    },
    restart: () => calls.push('restart'),
  };
  return { calls, steps };
}

describe('changeEndpoints', () => {
  it('ends the old session and forgets its nodes before saving a different cluster', async () => {
    const { calls, steps } = recorder();
    await changeEndpoints(['http://10.35.1.50:7438'], ['https://macnessa.macha.network'], steps);
    expect(calls).toEqual([
      'signOut',
      'forgetDiscovered',
      'save https://macnessa.macha.network',
      'flush',
      'restart',
    ]);
  });

  it('keeps the session when the list is the same', async () => {
    const { calls, steps } = recorder();
    await changeEndpoints(['http://a:7438/', 'http://b:7438'], ['http://B:7438', 'http://a:7438'], steps);
    expect(calls).toEqual(['save http://B:7438,http://a:7438', 'flush', 'restart']);
  });

  it('still changes cluster and restarts when the revoke fails', async () => {
    const { calls, steps } = recorder({ signOutFails: true });
    await changeEndpoints(['http://old:7438'], ['http://new:7438'], steps);
    expect(calls).toEqual(['signOut', 'forgetDiscovered', 'save http://new:7438', 'flush', 'restart']);
  });
});

describe('restartAfterFlush', () => {
  it('restarts only after the writes have landed', async () => {
    const calls: string[] = [];
    let land!: () => void;
    const pending = restartAfterFlush({
      flush: () => new Promise<void>((resolve) => (land = resolve)),
      restart: () => calls.push('restart'),
    });
    await Promise.resolve();
    expect(calls).toEqual([]);
    land();
    await pending;
    expect(calls).toEqual(['restart']);
  });

  it('restarts even when the flush fails', async () => {
    const calls: string[] = [];
    await restartAfterFlush({
      flush: () => Promise.reject(new Error('disk')),
      restart: () => calls.push('restart'),
    }).catch(() => undefined);
    expect(calls).toEqual(['restart']);
  });
});
