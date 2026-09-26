import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    // The Node server (npm start / scripts/dev.mjs) handles /api
    proxy: { '/api': `http://localhost:${process.env.PORT || 8085}` },
  },
  build: { target: 'es2022', cssMinify: true },
});
