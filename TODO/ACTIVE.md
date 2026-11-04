# Active

## The job

Tom, 2026-11-04: the Tizen client needs to be, as far as can be done, identical to the React Native Android TV client, and to be reoriginated rather than recovered from old builds. This repo was split out of `macha-client` for that.

Read `../macha-client-rn-tv` as the reference: read-only, never edit it. It has 11 screens in about 11,300 lines, `src/styles/theme.ts`, `src/hooks/tvFocus.ts` and `tv-now.jpg`, a screenshot of its sign-in screen.

## What is here

`src/` is a snapshot of `macha-client` at 4b20bb4: the whole web app in its Samsung build. It is a starting point so the repo builds and installs from day one, not the design. Web-only code is still in it, books with `foliate-js`, import, manage, identify and the Android files, and should go as screens are replaced.

Proposed, not yet agreed with Tom: screens ported from the Android TV client one at a time, on Chromium 47's layout, theme and focus first, then sign-in, Home, library, detail, player, the rest. Keep `src/platform/SamsungWebPlatform.ts` and the native HLS path in `WebPlatform.ts`, or take what they need, since playback cannot match ExoPlayer; see `TODO/inherited-tizen-notes.md`. Tom's reply on dropping import, manage and identify is still owed: he moved the work here before answering.

## Measured on the set, 2026-11-04

QE55Q6FAM at 10.44.1.183:26101, platform 3.0, UA `Tizen 3.0 / AppleWebKit 538.1`.

- About 68 s of black from launch to load event on a clean launch with no inspector attached; DOM ready at about 0.5 s. A trace with the inspector attached: `index-legacy` evaluates for 22 s, then one event handler runs for 43 s. That handler is not identified. Nothing is rendered until it finishes.
- `Proxy` does not exist and cannot be polyfilled. `new Proxy` in `src/playback/nodeStartCosts.ts` took the app down at startup from 6f77bf1 (2026-09-23) until 4b20bb4.
- No grid, flex `gap`, custom properties, `inset`, `clamp` or `min()`, per `CSS.supports`.
- The app stops at the sign-in screen: `POST /api/v1/session` answers 403 and `/status` 401, with a stored `macha.core.session`. `.login-screen` and `.connection-gate` are grid with no TV rule, so the panel sits full width at the top. In all, 50 of 93 grid classes have no rule in `samsung-tizen3.css`, and 36 `var()` uses are not rewritten.
- Tom used a working Samsung build for about a month and saw these problems solved. Do not argue that. The 149 TV rules are unchanged from 0.14.0 to now, ignoring comments, and that cause was not found. No old `.wgt` survives. He ruled out bisecting.

## The inspector on the set

`sdb -s 10.44.1.183:26101 shell 0 was_kill macha00001.Macha`, then `sdb -s 10.44.1.183:26101 shell 0 debug macha00001.Macha 300`. The trailing number is needed, or the answer is `closed`. It prints a port; `sdb forward tcp:PORT tcp:PORT`, then `http://127.0.0.1:PORT/json` lists the page and its WebSocket. `Runtime.evaluate`, `Network`, `Console` and `Tracing` all work. `Page.captureScreenshot` timed out once, so Tom's eyes are the check on looks. After a launch the page does not answer for about a minute, so wait for it.

## Rules

Tom owns git: no push, merge or deploy to a node unless he asks for that action. Never enter his password. No emoji, no em dashes, no real media titles or provider ids in anything committed, no Claude attribution in commits.
