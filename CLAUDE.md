# fast-md5-web

> Detailed agent instructions, skill catalog, and collaboration guidelines: [AGENTS.md](./AGENTS.md)

## Project

High-performance browser-side MD5 hashing library built on WebAssembly + Web Workers, supporting large-file streaming and multi-threaded concurrency.

## Quality Gates

```bash
pnpm run lint          # ESLint
pnpm run type-check    # TypeScript type checking
pnpm run format:check  # Prettier format checking
pnpm run build         # Build verification (includes WASM)
```

## Tests

```bash
pnpm run test          # Full suite (Vitest + Playwright)
pnpm run test:unit     # Unit tests only
pnpm run test:e2e      # E2E tests only
```

## Constraints

- ESM-only — do not introduce CommonJS compatibility
- `wasm/pkg/*` are generated artifacts — modify `wasm/src/*` then rebuild
- Large-file test baseline >= 300MB
- Commit hook runs `pnpm run test:hook`
