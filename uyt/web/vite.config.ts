import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.VITE_API_PROXY ?? 'http://localhost:4000';
// Set UYT_ALLOW_ANY_HOST=1 when the dev/preview server sits behind a tunnel or remote preview URL.
const anyHost = process.env.UYT_ALLOW_ANY_HOST === '1' ? { allowedHosts: true as const } : {};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    ...anyHost,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/socket.io': { target: API, ws: true },
    },
  },
  preview: { host: true, ...anyHost },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { charts: ['recharts'], vendor: ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
});
