# fast-md5-web

[English](README.md) | [中文](README-zh.md)

---

🚀 **Web 环境下最快的 MD5 计算库** - 基于 Rust WebAssembly，支持 **Web Worker** 实现真正的非阻塞计算。处理 1000+ 大文件时比 spark-md5 **快 100 倍**。

⚡ **纯 ESM 包** - 支持现代浏览器、Node.js 和 Deno 的 ES 模块。**不支持 CommonJS**。

## ✨ 特性

- 🧵 **Web Worker 池** - 真正的并行处理，可配置工作线程，防止 UI 阻塞
- 🦀 **Rust WebAssembly** - 编译为 WebAssembly 的原生 Rust 性能
- ⚡ **100倍性能** - 批量处理 1000+ 文件时比 spark-md5 快得多
- 📦 **纯 ESM** - 支持浏览器、Node.js 和 Deno 的现代 ES 模块（不支持 CommonJS）
- 📝 **TypeScript 支持** - 完整的 TypeScript 声明和类型安全
- 🔄 **异步处理** - 大文件分块处理，支持控制权让出
- 🎯 **灵活输出** - 支持 16 位和 32 位 MD5 哈希长度

## 📦 安装

```bash
npm install fast-md5-web
```

> **⚠️ 仅支持 ESM**: 此包仅支持 ES 模块。适用于现代浏览器、Node.js（需在 package.json 中设置 `"type": "module"`）和 Deno。不支持 CommonJS。

## 🚀 快速开始

```typescript
import { Md5CalculatorPool, WasmInit, Md5Calculator } from 'fast-md5-web';

// 方法1：使用工作池（推荐用于大文件）
const pool = new Md5CalculatorPool(navigator.hardwareConcurrency); // 自动检测 CPU 核心数

// 将文件转换为 Uint8Array
const file = new File(['Hello, World!'], 'example.txt');
const arrayBuffer = await file.arrayBuffer();
const data = new Uint8Array(arrayBuffer);

// 计算 MD5
const md5Hash = await pool.calculateMd5(data, 32); // 32位哈希
console.log('MD5:', md5Hash);

// 清理资源
pool.destroy();

// 方法2：直接使用 WASM（适用于小文件）
await WasmInit();
const calculator = new Md5Calculator();
const hash = await calculator.calculate_md5_async(data, 32);
console.log('MD5:', hash);
```

## 📚 API 参考

### `Md5CalculatorPool`

管理 Web Worker 池进行并行 MD5 计算。

```typescript
class Md5CalculatorPool {
  constructor(poolSize?: number); // 默认：navigator.hardwareConcurrency
  
  async calculateMd5(data: Uint8Array, md5Length?: number): Promise<string>;
  destroy(): void;
  getPoolStatus(): {
    totalWorkers: number;      // 总工作线程数
    availableWorkers: number;  // 可用工作线程数
    pendingTasks: number;      // 待处理任务数
  };
}
```

### `Md5Calculator`

直接的 WASM MD5 计算器。

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

**处理 1000 个大文件（每个 10MB）：**
- **fast-md5-web**: ~2.5 秒 ⚡
- **spark-md5**: ~250+ 秒 🐌
- **性能提升**: **快 100 倍** 🚀

### 关键优化

- **Web Worker 池**：真正的并行处理，防止主线程阻塞
- **Rust WebAssembly**：零成本抽象的原生性能
- **分块处理**：对超过 1MB 的文件自动优化
- **内存高效**：流式处理，控制内存使用
- **批量处理**：专为同时处理多个文件而优化

## 📄 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。