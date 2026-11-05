# macha-client-tizen-tv

_v0.1.0_

The Macha client for **Samsung Tizen televisions**: a signed `.wgt` web app on
Chromium 47 (Tizen 3), D-pad only.

It is, as far as can be done, identical to the Android TV client,
[`macha-client-rn-tv`](https://github.com/tomdionysus/macha-client-rn-android-tv):
the same screens, theme, focus model and words. Playback is what cannot match:
this set plays through its native HLS player in MPEG-TS, not ExoPlayer.
Everything that is not presentation comes from
[`@machafoundation/core`](https://www.npmjs.com/package/@machafoundation/core).

## What works

- Sign-in, Home and playback, seen on a QE55Q6FAM (Tizen 3, 3840x2160 panel,
  1920x1080 application surface).
- Movies, TV Shows, series and seasons, detail, Search, Music (albums), Status
  and Settings are ported and not yet checked on the set.
  [`TODO/ACTIVE.md`](TODO/ACTIVE.md) has the list.

## Where this sits

| Repo | What it is |
| --- | --- |
| [`macha`](https://github.com/tomdionysus/macha) | The server: a distributed filesystem and media server, every node an equal peer |
| [`macha-ts`](https://github.com/tomdionysus/macha-core-npm) | `@machafoundation/core`: API, cluster routing, playback coordination, client state |
| [`macha-client`](https://github.com/tomdionysus/macha-client) | React web client |
| [`macha-client-rn`](https://github.com/tomdionysus/macha-client-rn) | React Native phone app |
| [`macha-client-rn-tv`](https://github.com/tomdionysus/macha-client-rn-android-tv) | React Native Android TV |
| **`macha-client-tizen-tv`** | This: Samsung Tizen TV |

## Install on a television

The set must be in Developer mode, with `sdb` connected to it and a Tizen signing
profile in place. The Tizen CLI (`tizen`, `sdb`) must be on `PATH`, from
`~/tizen-studio/tools/ide/bin` and `~/tizen-studio/tools`.

```sh
npm install
npm run install-tv   # builds, packages, signs, installs and launches
```

`TV_SERIAL` is the set's sdb address and `CERT_PROFILE` the signing profile;
`install-samsung.sh` has the defaults. The build carries one server address, set
in `.env.samsung`; change it there, or in the app's Settings.

**Core is linked.** `package.json` uses the sibling checkout
(`file:../macha-ts`): clone it beside this repo and run `npm run build` there,
because this client imports core's `dist`.

## Check

```sh
npm run typecheck
npm test
npm run build
```

## How it is put together

```
PlaybackRuntime -- PlaybackCoordinator -- TizenVideoPlayer -- <video> (native HLS)
     (core)              (core)            (src/player)
```

- **Screens and components** are the Android TV client's, line for line, on
  `src/components/primitives.tsx`, which gives them React Native's `View`,
  `Text`, `ScrollView` and `Image` on the DOM.
- **Playback goes through core's `PlaybackCoordinator`**, which owns failover and
  stall recovery. `TizenVideoPlayer` implements core's `Player` and holds no
  policy: one media element, no standby.
- **What to ask for** is stated in `src/platform/TizenPlatform.ts`: MPEG-TS, and
  never a whole file. Every HLS fault measured on this set is fMP4's.
- **Focus** (`src/hooks/tvFocus.ts`) is the Android TV client's registry; here
  each element reads its own rectangle at the press.
- **Appearance** (`src/styles/theme.ts`) is the Android TV client's theme.
  Chromium 47 has no grid, flex `gap`, custom properties, `aspect-ratio`,
  `inset`, `clamp()` or eight-digit hex colours, so spacing is margins, sizes are
  computed, and colours go through `cssColour`.
- **Viewer text** is this client's, in `src/text/viewerText.ts`. Core supplies
  facts and codes, never words.
- **Missing from this engine:** `Proxy`, which cannot be polyfilled, and
  `AbortController`, which `src/platform/AbortControllerPolyfill.ts` installs
  before anything else runs.

## Further reading

- [`TODO/ACTIVE.md`](TODO/ACTIVE.md): open work, measurements on the set, and the
  inspector route.
- [`TODO/inherited-tizen-notes.md`](TODO/inherited-tizen-notes.md): what Tizen 3
  was measured to provide.
- [`docs/principles-and-laws.md`](docs/principles-and-laws.md): the laws every
  Macha project shares.
- `macha-ts/docs/writing-a-player.md`: the contracts behind core's `Player`.

## Licence

GPL-3.0-or-later.
