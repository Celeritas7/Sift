import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Sift/', // GitHub Pages project site: https://celeritas7.github.io/Sift/
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sift',
        short_name: 'Sift',
        description: 'Your notes, sifted: Keep import, relevance map, Weekly Focus sync and a vault.',
        theme_color: '#F4F0E8',
        background_color: '#F4F0E8',
        display: 'standalone',
        start_url: '/Sift/',
        scope: '/Sift/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // CJK/Devanagari fonts ship as hundreds of unicode-range subsets: cache them on first use instead of precaching.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallbackDenylist: [/^\/auth\//],
        runtimeCaching: [
          { urlPattern: ({ request }) => request.destination === 'font', handler: 'CacheFirst',
            options: { cacheName: 'sift-fonts', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
        ],
      },
    }),
  ],
});
