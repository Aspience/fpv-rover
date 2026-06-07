import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  envDir: path.resolve(__dirname, '..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://${process.env.VITE_RPI_HOST ?? 'localhost'}:${process.env.VITE_API_PORT ?? '8000'}`,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/ws': {
        target: `ws://${process.env.VITE_RPI_HOST ?? 'localhost'}:${process.env.VITE_API_PORT ?? '8000'}`,
        ws: true,
      },
    },
  },
})
