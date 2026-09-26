import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    port: 8303,
    // Dev server talks to the backend container; production uses the nginx proxy.
    proxy: { '/api': { target: process.env.VITE_API_TARGET ?? 'http://localhost:8301', changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // The slowest page tests take ~1.5 s alone; under a busy machine (a
    // build running alongside) the 5 s default failed them for no reason.
    testTimeout: 15_000,
  },
})
