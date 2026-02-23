# fast-md5-web 项目结构与边界映射

## 1) 仓库总览

- `src/`: TypeScript 公共入口与 Worker 池调度层
- `wasm/`: Rust MD5 计算核心与 wasm-pack 构建配置
- `example/test-fast-md5/`: Vue + Vite 示例应用与 Playwright e2e
- `__test/`: 根目录 Vitest 单元测试
- `scripts/`: 根目录工具脚本（如 postinstall）
- `docs/`: 贡献文档与示意资源

## 2) 关键入口文件

- `src/index.ts`
  - 导出 `Md5CalculatorPool`、`WasmInit`、`Md5Calculator`
  - 负责 Worker 池、任务队列、并发控制、共享内存与回退逻辑
- `src/md5-worker.ts`
  - Worker 线程入口
  - 负责处理 `calculate`/`calculate_chunk` 消息并调用 WASM
- `wasm/src/lib.rs`
  - Rust 侧 MD5 实现
  - 提供异步计算与增量计算会话
- `example/test-fast-md5/src/main.ts`
  - 示例应用入口
  - 暴露 `window.__FAST_MD5_WEB__` 供 e2e 调用
- `example/test-fast-md5/e2e/npm-methods.spec.ts`
  - npm 包方法的浏览器端 e2e 校验

## 3) 运行时数据流

1. 主线程调用 `Md5CalculatorPool.calculateMd5(...)`
2. 池按任务大小、优先级和并发限制调度 Worker
3. 小文件：消息传递或共享内存一次性计算
4. 大文件：分块发送 `calculate_chunk`，Worker 端增量更新 MD5
5. Worker 返回 `progress` 与 `result/error`

## 4) 构建链路

- 根目录 `pnpm run build`
  - 先执行 `pnpm run build:wasm`（`wasm-pack build --target web`）
  - 再执行 `tsup` 产出 `dist/index.js` 与 `dist/md5-worker.js`
- `wasm/pkg/*` 为 wasm-pack 生成产物，随 npm 包发布
- `example/test-fast-md5` 使用 `fast-md5-web` 的本地 link 依赖进行集成验证

## 5) 测试链路

- 单元测试（Vitest）：`__test/md5-calculator-pool.unit.test.ts`
- e2e 测试（Playwright）：`example/test-fast-md5/e2e/npm-methods.spec.ts`
- e2e fixture：
  - 生成脚本：`example/test-fast-md5/scripts/generate-fixtures.mjs`
  - 产物目录：`example/test-fast-md5/public/test-files/*`

## 6) Git Hook 链路

- `pre-commit`：`.husky/pre-commit`
  - `pnpm exec lint-staged`
  - `pnpm run type-check`
  - `pnpm run test:hook`（内部执行 `test:unit` + `test:e2e`）

## 7) 常见改动映射

- 修改公共 API 或池逻辑：
  - 改 `src/index.ts`
  - 补/改 `__test/*`
  - 必要时更新 `README*.md`
- 修改 Worker 消息协议：
  - 同步改 `src/index.ts` 与 `src/md5-worker.ts`
  - 补充单元测试和 e2e
- 修改 Rust 计算逻辑：
  - 改 `wasm/src/lib.rs`
  - 重新执行 `pnpm run build` 验证 TS 与 WASM 集成
- 修改示例与 e2e：
  - 改 `example/test-fast-md5/*`
  - 运行 `pnpm --dir example/test-fast-md5 run test:e2e`

## 8) 目录自检命令

```bash
rg --files src wasm example/test-fast-md5 __test scripts docs
```
