import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth":    { target: "http://localhost:8000", changeOrigin: true },
      "/user":    { target: "http://localhost:8000", changeOrigin: true },
      "/session": { target: "http://localhost:8000", changeOrigin: true },
      "/ws":      { target: "ws://localhost:8000",   changeOrigin: true, ws: true },
      "/health":  { target: "http://localhost:8000", changeOrigin: true },
    },
  },
})
