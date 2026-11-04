# Tizen notes inherited from macha-client

Moved from `macha-client/TODO/ACTIVE.md` when this repo was set up, 2026-11-04. Facts measured on the set, and open items. Line references and commit hashes in them are to macha-client.

## P1: What Tizen 3 actually provides, and one build behind

Measured on the set 2026-09-10, not inferred: a separate signed widget
carrying this app's own `polyfills-legacy` chunk, installed alongside Macha,
run, and uninstalled. UA `Tizen 3.0 / AppleWebKit 538.1`. Prompted by
`@machafoundation/core`'s new `types/platform-neutral.d.ts`, which states the platform
surface core is allowed to assume: a gate that proves core does not
*reference* anything outside the list, and cannot prove a host *provides* it.

**`AbortController` does not exist on Chromium 47 at all**, and the legacy
polyfill chunk does not supply one (core-js has none). It works here only
because `src/platform/AbortControllerPolyfill.ts` installs one from
`main.tsx:25` before anything else runs. So core's declared surface is met on
this platform by a **consumer-supplied shim**, not by the host. That shim is
load-bearing for every bounded request in the app: delete it, or let anything
run before it, and `fetchWithTimeout` throws on its first call.

**Two real gaps, both silent:**

- **`RequestInit.cache` is not merely unsupported: the property does not
  exist.** `'cache' in new Request(url, {cache:'no-store'})` is `false`, so
  `no-store` evaporates with no fallback. A cached `/api/v1/catalogue/status`
  would let a dead node answer 200 and stay top of the endpoint ranking.
  Fixed in core 0.7.0, which appends `?_=<ms>` to the probe URL, the only
  mechanism all three hosts honour, and the only one that also defeats an
  intermediary cache on a WAN path like es-1.
- **`keepalive` is absent**, so the teardown `DELETE` does not survive
  navigation on this set. Best-effort session close is lost there and nothing
  else.

**`{ once: true }` is ignored by Tizen's native `addEventListener`**: the
options-object probe returns `false` and a `once` listener on `window` fires
twice. It does not bite core, but only because the one signal core uses
`once` on is our own `LegacyAbortSignal`, which honours the flag itself. It is
correct here by accident of the shim, not because the host obeys.

**Present and behaving**, verified against a live 401 rather than a
constructed object: `fetch` (native), `Response.url` populated,
`ok`/`status`/`statusText`/`headers`, and `json()`/`text()`/`blob()`;
`Headers` with `get`/`set`/`forEach` (which does iterate, lower-casing names);
`new Response(body, {status, statusText, headers})`; native `URL` with
`origin`; `Blob` size/type; `DOMException` constructible as `(message, name)`;
`crypto.getRandomValues`. `crypto.randomUUID` is absent.

**Not measured, and worth knowing before relying on it:** whether Chromium 47
honours `init.signal` at all. It almost certainly does not: `signal`
postdates this engine, which would mean `fetchWithTimeout` still rejects on
time (the race is in JS) while the underlying request runs to completion. The
probe's abort test never ran, because it was gated on a native
`AbortController` that turned out not to exist.

- [ ] **Deploy a post-0.7.0 build to the Samsung.** The wgt currently on the
      set was built at 00:53 and `c8b1bb8` landed at 01:09; the shipped bundle
      has zero occurrences of the cache-busted probe URL. The one platform
      where `no-store` vanishes without a fallback is the one still missing
      the fix. Awaiting Tom: an unrequested action on that television is what
      broke it in the first place.
- [ ] **Re-verify failover on the Samsung while there.** That set has never
      run the 0.6.3 container fix and the 7 s stall budget together, and that
      combination is the one nobody has seen work.

**If anyone repeats the probe:** installing and then uninstalling a second
widget left `macha00001.Macha` installed but unlaunchable ("Could not launch
the null application", three attempts, with the app still in `applist`). A
reinstall of the wgt fixed it. Budget a redeploy as part of the exercise
rather than discovering it afterwards.

## P1: Releases keep shipping unseen on both televisions

Everything here is built, tested, and verified on the desk against gbni-1.
None of it has been looked at on a set. `COMPLETED.md` has what was built and
how it was measured; this is only what is left to confirm.

- [ ] **Android TV is the exposed host for Matroska.** It runs plain
      `WebPlatform` with no `neverDirect`, so if its WebView probes Matroska
      true it will direct play `.mkv` on the set. The only host where the
      container change can alter playback with no policy backstop; check it
      before the next Android build goes out.
- [ ] **Samsung: confirm, but the risk is nil.** `neverDirect: true` already
      forbids handing that set a whole file, so a Matroska claim changes only
      a reason string, not what is served. Worth logging what Chromium 47
      answers to the probe's impossible-codec guard, as a fact about the probe.
- [ ] **The login wall on a remote.** New markup on the screen a TV viewer now
      meets first, and focus is where this client has had trouble before.
      D-pad must reach both fields and the button, and the escape link to
      Settings → Connection must take focus visibly, because on a television
      it is the only way out and there is no address bar behind it.
- [ ] **The account control on a remote.** The identity is the trigger now, a
      wider target than the `⋯` it replaced, and its focus ring had to be
      restored explicitly against the base rule's specificity.
- [ ] **Signing in at all.** The post-login redirect and the refusal wording
      are unit-tested but have never run against a real account, because
      entering a password is off-limits to this assistant. One attempt by Tom
      settles both, as it does the Users screen, which has still never run
      against an account holding `manage_users`.
- [ ] **The node pills on a remote.** New focusable controls in the player's
      options panel (0.18.0), grouped and sorted; the D-pad must reach them
      and a press must state the preference. Never opened on a set; deployed
      since 2026-09-21.
- [ ] **The TV focus corrections ported 2026-09-24** (direction from edges,
      the current row first, sideways stopping at a row's end, up and down to
      the nearest row) have not been seen on a set.

## P1: The MPEG-TS preference is asserted, not gated

Samsung HLS playback is fixed (see COMPLETED.md). The reporting half of this
is now closed: server 0.33.1 states `output.container`, `@machafoundation/core` maps it,
and the player's top line shows the container actually served.

- [ ] **The preference is still not gated on a fact from the node serving
  it.** `copy_into_mpegts` exists on `operations` as of 0.33.1, and the
  chooser asks about whichever carriage the instruction names, but the facts
  are fetched from one node and the instruction may be performed by another.
  A cluster is not uniform in what its builds can do, and nothing checks that
  the node which answers can emit what the node which was asked said it could.
