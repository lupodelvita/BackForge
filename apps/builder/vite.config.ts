import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/gateway': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/api\/gateway/, ''),
      },
      '/api/analyzer': {
        target: 'http://localhost:8081',
        rewrite: (path) => path.replace(/^\/api\/analyzer/, ''),
      },
      '/api/codegen': {
        target: 'http://localhost:8084',
        rewrite: (path) => path.replace(/^\/api\/codegen/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
  },
})
