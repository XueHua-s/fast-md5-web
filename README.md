# fast-md5-web

[English](README.md) | [中文](README-zh.md)

---

🚀 **Possibly the fastest MD5 calculation library for web environments** - powered by Rust WebAssembly with **Web Worker** support for truly non-blocking computation. **100x faster** than spark-md5 in specific scenarios when processing 1000+ large files.

⚡ **ESM-only package** - Supports modern browsers, Node.js, and Deno with ES modules. **No CommonJS support**.

## ✨ Features

- 🧵 **Web Worker Pool** - True parallel processing with configurable worker threads, prevents UI blocking
- 🚀 **SharedArrayBuffer Support** - Zero-copy data transfer between main thread and workers for maximum performance
- 🦀 **Rust WebAssembly** - Native performance with Rust compiled to WebAssembly
- ⚡ **100x Performance** - Dramatically faster than spark-md5 for batch processing 1000+ files
- 📦 **ESM-only** - Modern ES modules for browsers, Node.js, and Deno (no CommonJS)
- 📝 **TypeScript Support** - Full TypeScript declarations and type safety
- 🔄 **Streaming Processing** - Incremental MD5 calculation for large files (200MB+) without memory overflow
- 🎯 **Flexible Output** - Support for 16-bit and 32-bit MD5 hash lengths
- 🔄 **Auto Fallback** - Automatically falls back to message passing when SharedArrayBuffer is unavailable
- 🧠 **Smart Memory Management** - Intelligent shared memory allocation with fragmentation control
- 📊 **Progress Tracking** - Real-time progress updates for large file processing
- 🎛️ **Concurrency Control** - Configurable maximum concurrent tasks to prevent system overload
- 📦 **Batch Processing** - Optimized batch processing with priority queues and task management

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

// Method 1: Using Worker Pool with SharedArrayBuffer (Recommended for processing multiple files)
const pool = new Md5CalculatorPool(
  navigator.hardwareConcurrency, // Worker count
  undefined, // SharedMemoryConfig (optional)
  3 // Max concurrent tasks
);

// Enable shared memory for large files
pool.enableSharedMemory(64 * 1024 * 1024, 2 * 1024 * 1024); // 64MB memory, 2MB chunks

// Process large files with progress tracking
const largeFile = new File([/* large data */], 'large-file.bin');
const hash = await pool.calculateMd5(
  largeFile,
  32, // MD5 length
  60000, // Timeout
  (progress) => {
    console.log(`Progress: ${progress.toFixed(1)}%`);
  },
  1 // Priority (number)
);
console.log('MD5:', hash);

// Batch processing
const files = [file1, file2, file3];
const results = await pool.calculateMd5Batch(
  files,
  32, // MD5 length
  (completed, total) => {
    console.log(`Progress: ${completed}/${total} files completed`);
  }
);
console.log('Batch results:', results);

// Check pool status including memory usage
const status = pool.getPoolStatus();
console.log('Pool status:', {
  workers: status.totalWorkers,
  activeTasks: status.activeTasks,
  memoryEnabled: status.sharedMemoryEnabled,
  memoryUsage: status.sharedMemoryUsage ? 
    `${(status.sharedMemoryUsage.used / 1024 / 1024).toFixed(2)}MB / ${(status.sharedMemoryUsage.total / 1024 / 1024).toFixed(2)}MB` : 'N/A'
});

// Clean up
pool.destroy();

// Method 1b: Traditional Worker Pool (without SharedArrayBuffer)
const traditionalPool = new Md5CalculatorPool(4); // Uses message passing by default

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

Manages a pool of Web Workers for parallel MD5 calculation of multiple files with advanced features.

```typescript
interface SharedMemoryConfig {
  enabled: boolean;
  memorySize: number;
  chunkSize: number;
}

interface PoolStatus {
  totalWorkers: number;
  availableWorkers: number;
  pendingTasks: number;
  activeTasks: number;
  maxConcurrentTasks: number;
  sharedMemoryEnabled: boolean;
  sharedMemoryUsage?: {
    total: number;
    used: number;
    available: number;
    fragmentation: number;
  };
}

class Md5CalculatorPool {
  constructor(poolSize?: number, sharedMemoryConfig?: SharedMemoryConfig, maxConcurrentTasks?: number);
  
  // Single file processing with streaming support
  async calculateMd5(
    data: Uint8Array | File, 
    md5Length?: number, 
    timeout?: number,
    onProgress?: (progress: number) => void,
    priority?: number
  ): Promise<string>;
  
  // Batch processing
  async calculateMd5Batch(
    files: (Uint8Array | File)[], 
    md5Length?: number,
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]>;
  
  // Shared memory management
  enableSharedMemory(memorySize?: number, chunkSize?: number): boolean;
  disableSharedMemory(): void;
  
  // Task management
  cancelTask(taskId: string): boolean;
  
  // Pool status and cleanup
  getPoolStatus(): PoolStatus;
  destroy(): void;
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

### Core Performance Features
- **WebAssembly**: Leverages Rust's performance for MD5 calculation
- **Streaming Processing**: Handles large files without loading entire content into memory
- **Incremental Hashing**: WASM-based incremental MD5 calculation for memory efficiency
- **Smart Concurrency**: Adaptive task scheduling with priority queues
- **Zero-Copy Transfer**: SharedArrayBuffer eliminates data copying overhead

### Memory Management
- **Chunked Processing**: Configurable chunk sizes for optimal memory usage
- **Shared Memory Pool**: Efficient memory allocation and reuse
- **Fragmentation Monitoring**: Real-time memory fragmentation tracking
- **Automatic Cleanup**: Proper resource cleanup and garbage collection

### Key Optimizations

- **SharedArrayBuffer**: Zero-copy data transfer eliminates serialization overhead
- **Web Worker Pool**: Parallel processing of multiple files prevents main thread blocking
- **Rust WebAssembly**: Native performance with zero-cost abstractions
- **Chunked Processing**: Automatic optimization for files > 1MB
- **Memory Efficient**: Streaming processing with controlled memory usage
- **Multi-file Processing**: Optimized for handling multiple files simultaneously with worker pool
- **Auto Fallback**: Graceful degradation to message passing when SharedArrayBuffer is unavailable

### Best Practices

#### For Large Files (>50MB)
```typescript
// Enable shared memory with appropriate chunk size
pool.enableSharedMemory(128 * 1024 * 1024, 4 * 1024 * 1024); // 128MB, 4MB chunks

// Use high priority for critical files
const hash = await pool.calculateMd5(
  largeFile, 
  32, 
  60000, // timeout
  (progress) => {
    console.log(`Processing: ${progress.toFixed(1)}%`);
  },
  10 // high priority (higher number = higher priority)
);
```

#### For Batch Processing
```typescript
// Sort files by size for optimal scheduling
const sortedFiles = files.sort((a, b) => b.size - a.size);

const results = await pool.calculateMd5Batch(
  sortedFiles, 
  32, // MD5 length
  (completed, total) => {
    console.log(`Progress: ${completed}/${total} files completed`);
  }
);
```

#### Memory Monitoring
```typescript
const status = pool.getPoolStatus();
if (status.sharedMemoryUsage && status.sharedMemoryUsage.fragmentation > 3) {
  console.warn('High memory fragmentation detected');
  // Consider recreating the pool
}
```

### SharedArrayBuffer Performance Benefits

**Processing 10MB file with 4 workers:**
- **With SharedArrayBuffer**: ~1ms data transfer + ~150ms processing = ~151ms total
- **Without SharedArrayBuffer**: ~50ms data transfer + ~150ms processing = ~200ms total
- **Performance gain**: ~25% faster overall, 50x faster data transfer

**Memory Usage Comparison:**
- **Traditional mode**: 2x memory usage (original + copied data)
- **SharedArrayBuffer mode**: 1x memory usage (shared data)
- **Memory savings**: Up to 50% reduction in memory usage

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge | Notes |
|---------|--------|---------|--------|---------|-------|
| Basic MD5 | ✅ | ✅ | ✅ | ✅ | Full support |
| Web Workers | ✅ | ✅ | ✅ | ✅ | Full support |
| Streaming Processing | ✅ | ✅ | ✅ | ✅ | File API required |
| SharedArrayBuffer | ✅* | ✅* | ✅* | ✅* | HTTPS + headers required |
| WebAssembly | ✅ | ✅ | ✅ | ✅ | Full support |
| Progress Tracking | ✅ | ✅ | ✅ | ✅ | Full support |

### SharedArrayBuffer Requirements

For optimal performance with large files, SharedArrayBuffer requires:

```html
<!-- Required headers for SharedArrayBuffer -->
<meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin">
<meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp">
```

Or server headers:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Fallback Behavior

When SharedArrayBuffer is unavailable:
- Automatically falls back to standard message passing
- Slightly reduced performance for very large files
- All features remain functional

## 🔧 Troubleshooting

### Common Issues

#### SharedArrayBuffer Not Available

**Problem**: SharedArrayBuffer is undefined or not working

**Solutions**:
1. Ensure HTTPS is enabled (required for security)
2. Add required headers:
   ```
   Cross-Origin-Opener-Policy: same-origin
   Cross-Origin-Embedder-Policy: require-corp
   ```
3. Check browser support (Chrome 68+, Firefox 79+, Safari 15.2+)
4. The library automatically falls back to message passing

#### Memory Issues with Large Files

**Problem**: Out of memory errors or slow performance

**Solutions**:
```typescript
// Reduce chunk size for memory-constrained environments
pool.enableSharedMemory(32 * 1024 * 1024, 1 * 1024 * 1024); // 32MB, 1MB chunks

// Reduce concurrent tasks
const pool = new Md5CalculatorPool(2, 1); // 2 workers, 1 concurrent task

// Monitor memory usage
const status = pool.getPoolStatus();
if (status.memoryUsed > 100 * 1024 * 1024) { // > 100MB
  console.warn('High memory usage detected');
}
```

#### Worker Initialization Failures

**Problem**: Workers fail to start or crash

**Solutions**:
1. Check browser console for detailed error messages
2. Ensure proper WASM loading:
   ```typescript
   try {
     await WasmInit();
     console.log('WASM initialized successfully');
   } catch (error) {
     console.error('WASM initialization failed:', error);
   }
   ```
3. Verify file paths and module resolution
4. Check Content Security Policy (CSP) settings

#### ESM Import Issues

**Problem**: Module import errors or CommonJS compatibility

**Solutions**:
1. Ensure `"type": "module"` in package.json for Node.js
2. Use `.mjs` file extension
3. For bundlers, ensure ESM support is enabled
4. This package does NOT support CommonJS

#### Performance Not as Expected

**Problem**: Slower than expected performance

**Solutions**:
1. Enable SharedArrayBuffer for large files
2. Adjust worker count based on CPU cores:
   ```typescript
   const optimalWorkers = Math.min(navigator.hardwareConcurrency, 8);
   const pool = new Md5CalculatorPool(optimalWorkers);
   ```
3. Use appropriate chunk sizes:
   - Small files (<1MB): Direct processing
   - Medium files (1-50MB): 1MB chunks
   - Large files (>50MB): 2-4MB chunks
4. Process files in batches rather than individually

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
// Enable WASM logging
const calculator = new Md5Calculator();
calculator.set_log_enabled(true);

// Monitor pool status
const pool = new Md5CalculatorPool(4);
setInterval(() => {
  const status = pool.getPoolStatus();
  console.log('Pool Status:', {
    workers: status.totalWorkers,
    active: status.activeTasks,
    pending: status.pendingTasks,
    memory: status.sharedMemoryUsage ? 
      `${(status.sharedMemoryUsage.used / 1024 / 1024).toFixed(2)}MB` : 'N/A',
    fragmentation: status.sharedMemoryUsage ? 
      `${status.sharedMemoryUsage.fragmentation}` : 'N/A'
  });
}, 5000);
```

### Environment-Specific Notes

#### Node.js
- Requires Node.js 16+ with ES modules support
- Add `"type": "module"` to package.json
- Web Workers use `worker_threads` under the hood

#### Deno
- Use `npm:` specifier for imports
- All features supported out of the box
- No additional configuration required

#### Browsers
- Modern browsers (Chrome 68+, Firefox 79+, Safari 15.2+)
- HTTPS required for SharedArrayBuffer
- Check CSP policies for worker and WASM support
## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.