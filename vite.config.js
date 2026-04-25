import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // proxy: {
    //   /**
    //    * Proxy /api/* → http://localhost:8000 in development.
    //    * This avoids CORS issues when the token server runs on a different port.
    //    * Set VITE_BACKEND_URL in .env to override for production.
    //    */
    //   '/api': {
    //     target: 'http://localhost:8000',
    //     changeOrigin: true,
    //     rewrite: (path) => path.replace(/^\/api/, ''),
    //   },
    // },
  },
})
