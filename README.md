# macha-client-tizen-tv

_v0.1.0_

The Macha client for **Samsung Tizen televisions**: a signed `.wgt` web app on Chromium 47 (Tizen 3), D-pad only.

The target is to be, as far as can be done, identical to [`macha-client-rn-tv`](../macha-client-rn-tv), the React Native Android TV client. See [`TODO/ACTIVE.md`](TODO/ACTIVE.md).

Everything that is not presentation comes from `@machafoundation/core`, linked from the sibling checkout `../macha-ts` during development. Run `npm run build` there first.

## Build and install

```sh
npm install
npm test
npm run install-tv   # builds, packages, signs, installs and launches
```

`TV_SERIAL` is the set's sdb address and `CERT_PROFILE` the Tizen signing profile; `install-samsung.sh` has the defaults. The Tizen CLI (`tizen`, `sdb`) must be on `PATH`, from `~/tizen-studio/tools/ide/bin` and `~/tizen-studio/tools`.
