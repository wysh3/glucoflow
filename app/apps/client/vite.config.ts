import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * One Vite build serves the browser and is bundled into the Android application.
 * The API base URL is public configuration, never a secret.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  define: {
    __GLUCOFLOW_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
