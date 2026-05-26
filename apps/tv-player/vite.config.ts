// apps/tv-player/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
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
        runtimeCaching: [{
          urlPattern: /^https:\/\/storage\.googleapis\.com\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'media-cache',
            expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 7 },
          },
        }],
      },
      manifest: {
        name: 'Koppiku TV Player',
        short_name: 'Koppiku TV',
        display: 'fullscreen',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
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
