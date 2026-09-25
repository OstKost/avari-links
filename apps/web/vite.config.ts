/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    isolate: false,
  },
  server: {
    port: 4810,
    proxy: {
      '/api': {
        target: 'http://localhost:4820',
        changeOrigin: true,
      },
      '^/s/': {
        target: 'http://localhost:4820',
        changeOrigin: true,
      },
      '/swagger': {
        target: 'http://localhost:4820',
        changeOrigin: true,
      },
    },
  },
});
