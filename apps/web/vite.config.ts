import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Reads .env from the repo root so `cp .env.example .env` at the root
  // (README setup) is the only file a developer needs to create.
  envDir: path.resolve(import.meta.dirname, '../..'),
  server: {
    port: 5173,
  },
});
