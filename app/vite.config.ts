/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo-name>/.
const BASE = '/Newhouse-Professional-Coaching/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Coaching Tracker',
        short_name: 'Coaching',
        description: 'Plan, time and log coaching sessions.',
        theme_color: '#1F5E57',
        background_color: '#F5F4EF',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    // Tests read ../apps-script/Shared.gs to check it matches src/shared/connector.ts.
    fs: { allow: ['.', '../apps-script'] },
  },
  test: {
    environment: 'node',
  },
});
