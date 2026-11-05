# Active

## The job

Tom, 2026-11-04: the Tizen client needs to be, as far as can be done, identical to the React Native Android TV client, and to be reoriginated rather than recovered from old builds. This repo was split out of `macha-client` for that.

`../macha-client-rn-tv` is the reference: read-only, never edit it.

## What is here

The web app snapshot is gone. `src/` is the Android TV client's source, file for file, on the DOM. All eleven screens are ported at once rather than one at a time, because they share one set of components.

- **Copied unchanged:** the platform-neutral logic and its tests (`app/`, `text/viewerText.ts`, `hooks/tvFocus.ts` with a self-measuring `measure`, and the rest).
- **Ported line for line:** every screen and component, on `components/primitives.tsx` in place of React Native's `View`, `Text`, `ScrollView` and `Image`.
- **Different by necessity:** `platform/TizenPlatform.ts` and `player/TizenVideoPlayer.ts` in place of ExoPlayer: one media element, native HLS, MPEG-TS, no standby. Storage is `localStorage`. There is no volume: the television owns it.
- **Dropped:** books, import, manage, identify, hls.js and react-router. The Android TV client has none of them. Tom has not been asked directly whether that suits the Samsung.

## Measured on the set, 2026-11-05

QE55Q6FAM at 10.44.1.183:26101, platform 3.0.

- The first build installed and reached the sign-in screen, styled by inspection of its geometry. Load event at 18.6 s with the inspector attached, against about 68 s before. DOM ready at 0.76 s. A clean launch has not been timed. The screen stays black until the bundle has run; nothing is drawn meanwhile.
- `tizen.tvinputdevice` answered `SecurityError` on that build, so the transport keys did nothing. `config.xml` now asks for `tv.inputdevice`; not yet installed or seen working.
- The panel is 3840x2160 (Tom confirmed). The application surface is 1920x1080 at ratio 1, and `screen`, `tizen.systeminfo` and the loaded `webapis` cannot report the panel, so automatic play stays uncapped.
- Tom saw letterboxing that looked wrong. One title's frame was 1920x958, which leaves about 61 px top and bottom by `contain`; another's was 1920x1080, which leaves none. The magenta test on the set has no answer yet.
- With the on-screen keyboard up the page height is 604, not 1080.
- Tom started a title on that build: the element ran natively at `readyState` 4, advancing, no error, reporting 640x360. Tom thinks 640x360 is the source; not checked further.
- Tom's first reports: a dark square round the logo, and missing posters. The square was the opaque PNG, now the SVG. Continue Watching's posters were signed URLs saved weeks ago: both answered 401 on the set, and the other URLs need a header an `<img>` cannot send. `LazyArtwork` now falls back to core's authenticated fetch. Both fixes are installed: the inspector reads no broken images, the two old posters loading as blobs, and the logo as the SVG. Tom confirmed the logo on 2026-11-05 and called the build much better than the previous Tizen version; he has not confirmed the posters. One Movies card draws its letter placeholder; whether that title has artwork has not been checked.
- `tv.inputdevice` is installed and `registerKey` now answers without error; a key press has not been tried. The sign-in survived the reinstall.

## Not yet seen on the set

Tom signed in on the first build and Home came up with his Continue Watching row, read through the inspector. Nobody has reported on how any of it looks or moves. In order:

- [ ] Sign-in on the remote: Return closes the keyboard, Up and Down leave a field.
- [ ] Home, library, detail, series, season, search, status, settings: looks against the Android TV client, focus, Back.
- [ ] Playback: start, seek, resume, options, subtitles, failover. `TizenVideoPlayer` is written and has unit tests on its pure parts only.
- [ ] Transport keys, once the privilege is installed.
- [ ] Why the load event takes as long as it does; the 43 s handler from the old build was never identified and may have gone with the old app.

## The inspector on the set

`sdb -s 10.44.1.183:26101 shell 0 was_kill macha00001.Macha`, then `sdb -s 10.44.1.183:26101 shell 0 debug macha00001.Macha 300`. The trailing number is needed, or the answer is `closed`. It prints a port; `sdb forward tcp:PORT tcp:PORT`, then `http://127.0.0.1:PORT/json` lists the page and its WebSocket. `Runtime.evaluate`, `Network`, `Console` and `Tracing` all work. `Page.captureScreenshot` timed out once, so Tom's eyes are the check on looks. After a launch the page does not answer for about a minute, so wait for it.

## Rules

Tom owns git: no push, merge or deploy to a node unless he asks for that action. Never enter his password. No emoji, no em dashes, no real media titles or provider ids in anything committed, no Claude attribution in commits.
