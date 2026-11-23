import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import http from 'http'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = env.BASE_URL_PATH || '/'

  const versionFile = mode === 'staging' ? 'VERSION-STAGING' : 'VERSION'
  process.env.VITE_APP_VERSION = fs
    .readFileSync(path.resolve(__dirname, '..', versionFile), 'utf8')
    .trim()

  return {
    base: basePath,
    plugins: [react()],
    define: {
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
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
    watch: {
      ignored: ['**/.*.tmpdir/**', '**/*.tmp'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5174',
        changeOrigin: true,
        agent: new http.Agent({ keepAlive: false }),
      },
    },
  },
  }
})