import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/md5-worker.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: false,
  target: 'es2020',
  outDir: 'dist',
  external: ['../wasm/pkg'],
  noExternal: [],
  platform: 'neutral',
  outExtension({ format }) {
    return {
      js: '.js'
    }
  },
  onSuccess: async () => {
    const fs = await import('fs')
    const path = await import('path')
    const mtsFile = path.join('dist', 'index.d.mts')
    const dtsFile = path.join('dist', 'index.d.ts')
    if (fs.existsSync(mtsFile)) {
      fs.renameSync(mtsFile, dtsFile)
      console.log('Renamed index.d.mts to index.d.ts')
    }
  },
  esbuildOptions(options) {
    options.banner = {
      js: '"use client"',
    }
  },
})