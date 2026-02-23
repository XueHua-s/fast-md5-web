# fast-md5-web 依赖落点与复用建议

## 1) 根目录运行时依赖（`package.json`）

- `uuid`
  - 用途：生成任务 ID（`src/index.ts`）
  - 修改建议：优先保持接口稳定，避免影响任务取消与回调索引逻辑

## 2) 根目录开发依赖（`package.json`）

- 构建链路
  - `tsup`: 打包 `src/index.ts` 与 `src/md5-worker.ts`
  - `typescript`: TS 编译与类型检查
- 质量与格式
  - `eslint` + `@typescript-eslint/*`
  - `prettier`
  - `oxlint`
- 测试
  - `vitest`: 根目录单元测试框架
- 工程协作
  - `husky`
  - `@commitlint/*`
  - `rimraf`

## 3) Rust WASM 依赖（`wasm/Cargo.toml`）

- `md-5`（包名映射为 `md5`）
  - 用途：核心哈希算法
- `wasm-bindgen` / `wasm-bindgen-futures` / `js-sys` / `web-sys`
  - 用途：WASM 与 JS 互操作
- `console_error_panic_hook`
  - 用途：Rust panic 调试信息输出

## 4) 示例工程依赖（`example/test-fast-md5/package.json`）

- 业务依赖
  - `fast-md5-web`（`link:../..`）：指向当前仓库，验证本地最新实现
  - `spark-md5`、`js-md5`：对照或性能测试场景
  - `vue`
- 工具依赖
  - `vite` + `@vitejs/plugin-vue`
  - `@playwright/test`：浏览器 e2e
  - `typescript` / `vue-tsc`

## 5) 依赖选择与变更原则

- 优先复用现有依赖，不重复引入同类工具。
- 新增依赖前先判断作用域：
  - 根目录公共库能力 -> 根目录 `package.json`
  - 示例或 e2e 专属能力 -> `example/test-fast-md5/package.json`
  - WASM 算法或绑定相关 -> `wasm/Cargo.toml`
- 不将示例工程专属依赖泄漏到主库发布依赖中。
- 涉及依赖升级时，至少执行：
  - `pnpm run type-check`
  - `pnpm run test`
- commit hook 会强制执行：
  - `pnpm run test:hook`（Vitest + Playwright）
