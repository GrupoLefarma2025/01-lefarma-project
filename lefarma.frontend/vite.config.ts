import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Shiki bundles all languages (~600KB gzip) - this is expected for a code editor
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          'shiki': ['shiki'],
          'radix-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-checkbox', '@radix-ui/react-switch', '@radix-ui/react-scroll-area'],
          'react-vendor': ['react', 'react-dom', 'react-hook-form', '@hookform/resolvers'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
})