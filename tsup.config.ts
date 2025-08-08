import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
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
  esbuildOptions(options) {
    options.banner = {
      js: '"use client"',
    }
  },
})