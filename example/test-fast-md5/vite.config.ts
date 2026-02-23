import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  optimizeDeps: {
    exclude: ['fast-md5-web']
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
