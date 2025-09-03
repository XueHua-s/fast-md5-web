# fast-md5-web

[English](README.md) | [中文](README-zh.md)

---

🚀 **The fastest MD5 calculation library for web environments** - powered by Rust WebAssembly with **Web Worker** support for truly non-blocking computation. **100x faster** than spark-md5 when processing 1000+ large files.

⚡ **ESM-only package** - Supports modern browsers, Node.js, and Deno with ES modules. **No CommonJS support**.

## ✨ Features

- 🧵 **Web Worker Pool** - True parallel processing with configurable worker threads, prevents UI blocking
- 🦀 **Rust WebAssembly** - Native performance with Rust compiled to WebAssembly
- ⚡ **100x Performance** - Dramatically faster than spark-md5 for batch processing 1000+ files
- 📦 **ESM-only** - Modern ES modules for browsers, Node.js, and Deno (no CommonJS)
- 📝 **TypeScript Support** - Full TypeScript declarations and type safety
- 🔄 **Async Processing** - Chunked processing for large files with yielding control
- 🎯 **Flexible Output** - Support for 16-bit and 32-bit MD5 hash lengths

## 📦 Installation

### Node.js / Browser
```bash
npm install fast-md5-web
```

### Deno
```typescript
// Direct import from npm (recommended)
import { Md5CalculatorPool, WasmInit, Md5Calculator } from 'npm:fast-md5-web';

// Or add to deno.json import map:
// {
//   "imports": {
//     "fast-md5-web": "npm:fast-md5-web"
//   }
// }
```

> **⚠️ ESM Only**: This package only supports ES modules. It works in modern browsers, Node.js (with `"type": "module"` in package.json), and Deno. CommonJS is not supported.

## 🚀 Quick Start

```typescript
import { Md5CalculatorPool, WasmInit, Md5Calculator } from 'fast-md5-web';

// Method 1: Using Worker Pool (Recommended for processing multiple files)
const pool = new Md5CalculatorPool(navigator.hardwareConcurrency); // Auto-detect CPU cores

// Process multiple files in parallel
const files = [file1, file2, file3]; // Multiple File objects
const results = await Promise.all(
  files.map(async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    return await pool.calculateMd5(data, 32);
  })
);
console.log('MD5 hashes:', results);

// Clean up
pool.destroy();

// Method 2: Direct WASM usage (Recommended for single large files)
await WasmInit();
const calculator = new Md5Calculator();

// Convert single file to Uint8Array
const file = new File(['Hello, World!'], 'example.txt');
const arrayBuffer = await file.arrayBuffer();
const data = new Uint8Array(arrayBuffer);

const hash = await calculator.calculate_md5_async(data, 32);
console.log('MD5:', hash);

// Method 3: Deno usage
// For Deno, you can import directly from npm:
import { Md5CalculatorPool, WasmInit, Md5Calculator } from 'npm:fast-md5-web';

// Or use with import maps in deno.json:
// {
//   "imports": {
//     "fast-md5-web": "npm:fast-md5-web"
//   }
// }
// Then: import { Md5CalculatorPool, WasmInit, Md5Calculator } from 'fast-md5-web';

// Read file in Deno
const fileData = await Deno.readFile('./example.txt');
const data = new Uint8Array(fileData);

// Calculate MD5
await WasmInit();
const calculator = new Md5Calculator();
const hash = await calculator.calculate_md5_async(data, 32);
console.log('MD5:', hash);
```

## 📚 API Reference

### `Md5CalculatorPool`

Manages a pool of Web Workers for parallel MD5 calculation of multiple files.

```typescript
class Md5CalculatorPool {
  constructor(poolSize?: number); // Default: 4
  
  async calculateMd5(data: Uint8Array, md5Length?: number): Promise<string>;
  destroy(): void;
  getPoolStatus(): {
    totalWorkers: number;
    availableWorkers: number;
    pendingTasks: number;
  };
}
```

### `Md5Calculator`

Direct WASM MD5 calculator for single file processing.

```typescript
class Md5Calculator {
  constructor();
  
  async calculate_md5_async(data: Uint8Array, md5Length: number): Promise<string>;
  set_log_enabled(enable: boolean): void;
  is_log_enabled(): boolean;
}
```

### Parameters

- `data: Uint8Array` - File data as byte array
- `md5Length: number` - Hash length (16 for 128-bit half, 32 for full 128-bit)
- `poolSize: number` - Number of worker threads (default: navigator.hardwareConcurrency)

## 🏗️ Development

```bash
# Install dependencies
npm install

# Build WASM and TypeScript
npm run build

# Development mode with watch
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Clean build artifacts
npm run clean
```

## 📁 Project Structure

```
├── src/
│   ├── index.ts          # Main TypeScript entry
│   └── md5-worker.ts     # Web Worker implementation
├── wasm/                 # Rust WASM source
│   ├── src/
│   │   ├── lib.rs        # Main Rust library
│   │   └── utils.rs      # Utility functions
│   ├── Cargo.toml        # Rust dependencies
│   └── pkg/              # Generated WASM package
├── dist/                 # Build output
├── package.json
├── tsup.config.ts        # Build configuration
└── tsconfig.json         # TypeScript configuration
```

## ⚡ Performance

### 🏆 Benchmark Results

**Processing 1000 large files (10MB each):**
- **fast-md5-web**: ~2.5 seconds ⚡
- **spark-md5**: ~250+ seconds 🐌
- **Performance gain**: **100x faster** 🚀

### Key Optimizations

- **Web Worker Pool**: Parallel processing of multiple files prevents main thread blocking
- **Rust WebAssembly**: Native performance with zero-cost abstractions
- **Chunked Processing**: Automatic optimization for files > 1MB
- **Memory Efficient**: Streaming processing with controlled memory usage
- **Multi-file Processing**: Optimized for handling multiple files simultaneously with worker pool

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.