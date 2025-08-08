# Rust WASM Calculate File MD5

A TypeScript project that uses tsup as the bundler for integrating with Rust WebAssembly MD5 calculation.

## Features

- 🦀 Rust WebAssembly for high-performance MD5 calculation
- 📦 TypeScript with tsup bundler
- 🔧 Modern build toolchain
- 📝 Full TypeScript support with declarations
- 🎯 Multiple output formats (CJS, ESM)

## Installation

```bash
npm install
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch mode for development
npm run dev

# Type checking
npm run type-check

# Clean build artifacts
npm run clean
```

## Usage

```typescript
import { calculateFileMD5, initWasm } from 'rust-wasm-calculate-file-md5';

// Initialize WASM module first
await initWasm();

// Calculate MD5 of a file
const file = new File(['content'], 'example.txt');
const md5Hash = await calculateFileMD5(file);
console.log('MD5:', md5Hash);
```

## Project Structure

```
├── src/
│   └── index.ts          # Main TypeScript entry point
├── web/                  # Rust WASM source code
│   ├── src/
│   ├── Cargo.toml
│   └── ...
├── dist/                 # Build output
├── package.json
├── tsup.config.ts        # tsup configuration
├── tsconfig.json         # TypeScript configuration
└── README.md
```

## Build Configuration

This project uses [tsup](https://tsup.egoist.dev/) for bundling with the following features:

- Multiple output formats (CommonJS, ESM)
- TypeScript declaration files generation
- Source maps
- Tree shaking
- Modern ES2020 target

## License

MIT License - see LICENSE files for details.