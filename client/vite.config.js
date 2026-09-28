import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The browser uses /api; Vite forwards those requests to Express locally.
const apiProxy = {
  '/api': { target: 'http://127.0.0.1:5000' },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The copied node_modules directory can be read-only on Windows. A temporary
  // cache keeps Vite's generated dependency files outside that folder.
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: apiProxy,
  },
});
