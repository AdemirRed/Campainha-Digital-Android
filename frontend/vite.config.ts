import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Disable PWA plugin on Termux to avoid Terser issues
const isTermux = process.env.TERMUX_VERSION !== undefined || process.env.DISABLE_PWA === 'true';

export default defineConfig({
  plugins: [
    react(),
    // Only enable PWA if not on Termux
    ...(!isTermux ? [
      VitePWA({
        registerType: 'autoUpdate',
        // injectManifest (not the default generateSW) so src/sw.ts can add
        // custom push/notificationclick handlers - needed to ring a
        // resident's device even with the site closed.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'Campainha Digital Inteligente',
          short_name: 'Campainha',
          description: 'Sistema de campainha inteligente com interface kiosk',
          theme_color: '#1e293b',
          background_color: '#0f172a',
          display: 'fullscreen',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
        devOptions: {
          enabled: false
        }
      })
    ] : [])
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Use esbuild instead of terser for better Termux compatibility
    minify: 'esbuild',
    target: 'esnext'
  }
});
