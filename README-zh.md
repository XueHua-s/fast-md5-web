# fast-md5-web

[English](README.md) | [中文](README-zh.md)

---

🚀 **可能是Web 环境下最快的 MD5 计算库** - 基于 Rust WebAssembly，支持 **Web Worker** 实现真正的非阻塞计算。单线程模式比 spark-md5 **快 8 倍**，多线程 Worker 模式**快 16 倍**。

⚡ **纯 ESM 包** - 支持现代浏览器、Node.js 和 Deno 的 ES 模块。**不支持 CommonJS**。

## ✨ 特性

- 🧵 **Web Worker 池** - 真正的并行处理，可配置工作线程，防止 UI 阻塞
- 🚀 **SharedArrayBuffer 支持** - 主线程与 Worker 间零拷贝数据传输，实现最大性能
- 🦀 **Rust WebAssembly** - 编译为 WebAssembly 的原生 Rust 性能
- ⚡ **高性能** - 单线程模式比 spark-md5 快 8 倍，多线程 Worker 模式快 16 倍
- 📦 **纯 ESM** - 支持浏览器、Node.js 和 Deno 的现代 ES 模块（不支持 CommonJS）
- 📝 **TypeScript 支持** - 完整的 TypeScript 声明和类型安全
- 🔄 **异步处理** - 大文件分块处理，支持控制权让出
- 🎯 **灵活输出** - 支持 16 位和 32 位 MD5 哈希长度
- 🔄 **自动回退** - SharedArrayBuffer 不可用时自动回退到消息传递模式

## 📦 安装

### Node.js / 浏览器
```bash
npm install fast-md5-web
```

### Deno
```typescript
// 直接从 npm 导入（推荐）
import { Md5CalculatorPool, WasmInit, Md5Calculator } from 'npm:fast-md5-web';

// 或者添加到 deno.json 导入映射：
// {
//   "imports": {
//     "fast-md5-web": "npm:fast-md5-web"
//   }
// }
```

> **⚠️ 仅支持 ESM**: 此包仅支持 ES 模块。适用于现代浏览器、Node.js（需在 package.json 中设置 `"type": "module"`）和 Deno。不支持 CommonJS。

## 🚀 快速开始

```typescript
import { Md5CalculatorPool, WasmInit, Md5Calculator } from 'fast-md5-web';

// 方法 1：使用带 SharedArrayBuffer 的 Worker 池（推荐用于处理多个文件）
const pool = new Md5CalculatorPool(
  navigator.hardwareConcurrency, // 工作线程数
  {
    enabled: true,                    // 启用 SharedArrayBuffer 实现零拷贝传输
    memorySize: 64 * 1024 * 1024,    // 64MB 共享内存
    chunkSize: 8 * 1024 * 1024       // 8MB 分块大小
  }
);

// 并行处理多个文件
const files = [file1, file2, file3]; // 多个 File 对象
const results = await pool.calculateMd5Batch(files, 32);
console.log('MD5 哈希值:', results);

// 检查池状态，包括共享内存使用情况
const status = pool.getPoolStatus();
console.log('池状态:', {
  总工作线程: status.totalWorkers,
  活跃任务: status.activeTasks,
  共享内存启用: status.sharedMemoryEnabled,
  内存使用: status.sharedMemoryUsage ? 
    `${(status.sharedMemoryUsage.used / 1024 / 1024).toFixed(2)}MB / ${(status.sharedMemoryUsage.total / 1024 / 1024).toFixed(2)}MB` : '不可用'
});

// 清理资源
pool.destroy();

// 方法 1b：传统 Worker 池（不使用 SharedArrayBuffer）
const traditionalPool = new Md5CalculatorPool(4); // 默认使用消息传递

// 方法2：直接使用 WASM（推荐用于单个小文件快速计算）
await WasmInit();
const calculator = new Md5Calculator();

// 将单个文件转换为 Uint8Array
const file = new File(['Hello, World!'], 'example.txt');
const arrayBuffer = await file.arrayBuffer();
const data = new Uint8Array(arrayBuffer);

const hash = await calculator.calculate_md5_async(data, 32);
console.log('MD5:', hash);

// 方法3：Deno 使用方式
// 在 Deno 中，你可以直接从 npm 导入：
import { Md5CalculatorPool, WasmInit, Md5Calculator } from 'npm:fast-md5-web';

// 或者在 deno.json 中使用导入映射：
// {
//   "imports": {
//     "fast-md5-web": "npm:fast-md5-web"
//   }
// }
// 然后：import { Md5CalculatorPool, WasmInit, Md5Calculator } from 'fast-md5-web';

// 在 Deno 中读取文件
const fileData = await Deno.readFile('./example.txt');
const data = new Uint8Array(fileData);

// 计算 MD5
await WasmInit();
const calculator = new Md5Calculator();
const hash = await calculator.calculate_md5_async(data, 32);
console.log('MD5:', hash);
```

## 📚 API 参考

### `Md5CalculatorPool`

管理 Web Worker 池进行多文件并行 MD5 计算。

```typescript
interface SharedMemoryConfig {
  enabled: boolean;     // 启用 SharedArrayBuffer 支持
  memorySize: number;   // 共享内存大小（字节）
  chunkSize: number;    // 分块大小（字节）
}

class Md5CalculatorPool {
  constructor(poolSize?: number, sharedMemoryConfig?: SharedMemoryConfig, maxConcurrentTasks?: number);
  
  // 单文件处理
  async calculateMd5(
    data: Uint8Array | File, 
    md5Length?: number, 
    timeout?: number,
    onProgress?: (progress: number) => void,
    priority?: number
  ): Promise<string>;
  
  // 批量处理
  async calculateMd5Batch(
    files: (Uint8Array | File)[], 
    md5Length?: number,
    timeout?: number, // 单个文件的超时时间
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]>;
  
  destroy(): void;
  getPoolStatus(): {
    totalWorkers: number;         // 总工作线程数
    availableWorkers: number;     // 可用工作线程数
    pendingTasks: number;         // 待处理任务数
    activeTasks: number;          // 活跃任务数
    maxConcurrentTasks: number;   // 最大并发任务数（默认等于线程数）
    sharedMemoryEnabled: boolean; // 共享内存是否启用
    sharedMemoryUsage?: {         // 共享内存使用情况
      total: number;              // 总内存大小
      used: number;               // 已使用内存
      available: number;          // 可用内存
      fragmentation: number;      // 内存碎片数量
    };
  };
  
  // 动态共享内存控制
  enableSharedMemory(memorySize?: number, chunkSize?: number): boolean;
  disableSharedMemory(): void;
  
  // 任务管理
  cancelTask(taskId: string): boolean;
}
```

### `Md5Calculator`

用于单文件处理的直接 WASM MD5 计算器。

```typescript
class Md5Calculator {
  constructor();
  
  async calculate_md5_async(data: Uint8Array, md5Length: number): Promise<string>;
  set_log_enabled(enable: boolean): void;  // 设置日志开关
  is_log_enabled(): boolean;               // 获取日志状态
}
```

### 参数说明

- `data: Uint8Array` - 文件数据字节数组
- `md5Length: number` - 哈希长度（16表示128位的一半，32表示完整128位）
- `poolSize: number` - 工作线程数量（默认：navigator.hardwareConcurrency）

## 🏗️ 开发

```bash
# 安装依赖
npm install

# 构建 WASM 和 TypeScript
npm run build

# 开发模式（监听文件变化）
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint
npm run lint:fix

# 代码格式化
npm run format
npm run format:check

# 清理构建产物
npm run clean
```

## ⚠️ 生产环境要求

要在生产环境中使用 SharedArrayBuffer 以获得最佳性能，您的网站必须满足以下条件：

1. **必须通过 HTTPS 提供服务** - 这是创建安全上下文的必要条件
2. **必须设置跨源隔离 HTTP 头部**：
   ```
   Cross-Origin-Opener-Policy: same-origin
   Cross-Origin-Embedder-Policy: require-corp
   ```

## ⏱️ 超时设置

在 `calculateMd5` 方法中，`timeout` 参数控制计算超时时间（毫秒）。
- 默认值：60000ms（1分钟）
- 设置为 0 表示不设置超时

示例：
```typescript
// 不设置超时
await pool.calculateMd5(file, 32, 0);
```

## 📁 项目结构

```
├── src/
│   ├── index.ts          # 主要 TypeScript 入口
│   └── md5-worker.ts     # Web Worker 实现
├── wasm/                 # Rust WASM 源码
│   ├── src/
│   │   ├── lib.rs        # 主要 Rust 库
│   │   └── utils.rs      # 工具函数
│   ├── Cargo.toml        # Rust 依赖配置
│   └── pkg/              # 生成的 WASM 包
├── dist/                 # 构建输出
├── package.json
├── tsup.config.ts        # 构建配置
└── tsconfig.json         # TypeScript 配置
```

## ⚡ 性能特点

### 🏆 基准测试结果

**性能对比：**
- **单线程模式**: 比 spark-md5 快约 8 倍 ⚡
- **多线程 Worker**: 比 spark-md5 快约 16 倍 🚀
- **在线演示**: [查看性能测试结果](./example/test-fast-md5/dist/index.html)

![多线程测试结果](./docs/a3d25c4789a9937d8a1fc76c12b61152.png)

### 关键优化

- **SharedArrayBuffer**：零拷贝数据传输，消除序列化开销
- **Web Worker 池**：多文件并行处理，防止主线程阻塞
- **Rust WebAssembly**：零成本抽象的原生性能
- **分块处理**：对超过 1MB 的文件自动优化
- **内存高效**：流式处理，控制内存使用
- **多文件处理**：使用工作池专为同时处理多个文件而优化
- **自动回退**：SharedArrayBuffer 不可用时优雅降级到消息传递

### SharedArrayBuffer 性能优势

**使用 4 个工作线程处理 10MB 文件：**
- **使用 SharedArrayBuffer**：~1ms 数据传输 + ~150ms 处理 = ~151ms 总计
- **不使用 SharedArrayBuffer**：~50ms 数据传输 + ~150ms 处理 = ~200ms 总计
- **性能提升**：整体快 25%，数据传输快 50 倍

**内存使用对比：**
- **传统模式**：2 倍内存使用（原始数据 + 复制数据）
- **SharedArrayBuffer 模式**：1 倍内存使用（共享数据）
- **内存节省**：最多减少 50% 内存使用

## 📄 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。
