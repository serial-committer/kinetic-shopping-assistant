/* ---------------------------------------
    The web page's dev server and build. Ports come from the same settings service as the API server, so .env is
    the one place to change them. Requests to /api go to the API server on 127.0.0.1.
--------------------------------------- */

import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { getConfig } from '../server/config/config.ts';

const settings = getConfig();

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    host: 'localhost',
    port: settings.webPort,
    strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${settings.serverPort}` } },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    /* -- Keep every asset a real file; inlined data: URLs trip strict content policies -- */
    assetsInlineLimit: 0,
  },
});
