// apps/tv-player/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { RangeRequestsPlugin } from 'workbox-range-requests'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      react: path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // Videos (transcoded MP4s) — CacheFirst with range request support.
            // Must be listed before the general GCS pattern below.
            urlPattern: /^https:\/\/storage\.googleapis\.com\/.*\/transcoded\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-cache-video',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 * 7 },
              plugins: [
                new RangeRequestsPlugin(),
                {
                  cacheWillUpdate: async ({ response }: { response: Response }) =>
                    response?.status === 200 || response?.status === 206 ? response : null,
                },
              ],
            },
          },
          {
            // Images — StaleWhileRevalidate: serves from cache instantly,
            // re-fetches in background so bad entries self-heal after one cycle.
            urlPattern: /^https:\/\/storage\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'media-cache-image',
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 7 },
              plugins: [
                {
                  cacheWillUpdate: async ({ response }: { response: Response }) =>
                    response?.status === 200 ? response : null,
                },
              ],
            },
          },
        ],
      },
      manifest: {
        name: 'Koppiku TV Player',
        short_name: 'Koppiku TV',
        display: 'fullscreen',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
      },
    }),
  ],
  // @ts-expect-error vitest adds 'test' to UserConfig via its own types
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    server: {
      deps: {
        inline: ['@testing-library/react'],
      },
    },
  },
})
