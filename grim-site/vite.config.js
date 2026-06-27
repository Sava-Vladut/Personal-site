import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In Docker the FastAPI backend is reachable at http://api:8000; locally it
// defaults to localhost. Override with VITE_API_PROXY when needed.
const apiProxyTarget = process.env.VITE_API_PROXY ?? 'http://localhost:8000'

// Bind-mounted source on some hosts (macOS/Windows) needs polling for HMR.
const usePolling = process.env.VITE_USE_POLLING === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: usePolling ? { usePolling: true } : undefined,
    proxy: {
      // Forward converter API calls to the FastAPI backend (server/app.py).
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
