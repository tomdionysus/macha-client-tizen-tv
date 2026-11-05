import packageInfo from './package.json';
import type { Plugin } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// config.xml carries one launcher icon; the other Samsung launcher artwork goes through
// Seller Office, with its build assets under public/samsung/.
function samsungManifest(version: string): Plugin {
  return {
    name: 'macha-samsung-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'config.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<widget
    xmlns="http://www.w3.org/ns/widgets"
    xmlns:tizen="http://tizen.org/ns/widgets"
    id="http://macha.local/client"
    version="${version}"
    viewmodes="maximized">

    <tizen:application
        id="macha00001.Macha"
        package="macha00001"
        required_version="2.4"/>

    <content src="index.html"/>
    <icon src="samsung/macha-icon-package-117.png"/>
    <name>Macha</name>

    <tizen:profile name="tv-samsung"/>

    <tizen:privilege
        name="http://tizen.org/privilege/internet"/>

    <!-- Without this, registering the remote's transport keys answers SecurityError (measured). -->
    <tizen:privilege
        name="http://tizen.org/privilege/tv.inputdevice"/>

    <access origin="*" subdomains="true"/>
</widget>
`,
      });
    },
  };
}

export default defineConfig({
  // A widget loads from file://, so every asset path is relative.
  base: './',
  plugins: [
    react(),
    // Tizen 3 is Chromium 47: one legacy bundle, no modern chunk to skip.
    legacy({
      targets: ['Chrome >= 47'],
      renderModernChunks: false,
      additionalLegacyPolyfills: ['core-js/proposals/global-this'],
    }),
    samsungManifest(packageInfo.version),
  ],
  test: {
    // Pure logic only: the screens are checked on the set.
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: './src/test/setup.ts',
    // No deadline: a timeout fails a correct test on a loaded machine. A hung test shows
    // as a run that never finishes.
    testTimeout: 0,
    hookTimeout: 0,
  },
});
