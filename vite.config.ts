import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Sift',
        short_name: 'Sift',
        description: 'Your notes, sifted: Keep import, relevance map, Weekly Focus sync and a vault.',
        theme_color: '#F4F0E8',
        background_color: '#F4F0E8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // CJK/Devanagari fonts ship as hundreds of unicode-range subsets: cache them on first use instead of precaching.
        globPatterns: ['**/*.{js,css,html,svg}'],
        navigateFallbackDenylist: [/^\/auth\//],
        runtimeCaching: [
          { urlPattern: ({ request }) => request.destination === 'font', handler: 'CacheFirst',
            options: { cacheName: 'sift-fonts', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
        ],
      },
    }),
  ],
});
