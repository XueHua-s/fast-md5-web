---
name: fast-md5-web-project-spec
description: "fast-md5-web 全局架构与改造规范。用于跨 `src/*`、`wasm/*`、`example/test-fast-md5/*`、`__test/*`、`scripts/*` 的功能迭代、接口重构、性能优化、并发与内存治理，并按《软件设计的哲学》原则直接实施代码改造时。默认全局提示词见 `references/global-prompt.md`。"
---

# fast-md5-web 项目规范技能

## 快速开始

- 读取 `references/global-prompt.md`，将其作为当前任务的默认全局提示词并贯彻执行。
- 涉及路径定位或跨模块改动时，先读取 `fast-md5-web-project-structure` 技能中的 `references/project-structure.md`。
- 路径不确定时，先执行 `rg --files src wasm example/test-fast-md5 __test scripts docs` 确认最新目录映射。

## 注意事项

- 保持库为 ESM-only；避免引入 CommonJS 兼容分支导致构建和运行行为分裂。
- `wasm/pkg/*` 为生成产物；除非明确在做构建链路修复，否则优先修改 `wasm/src/*` 后再重新构建。
- 变更 `Md5CalculatorPool` 或 `md5-worker` 消息协议时，同步验证 SharedArrayBuffer 路径与消息传递回退路径。
- 涉及 `example/test-fast-md5` 的改动，保持 `Cross-Origin-Opener-Policy` 和 `Cross-Origin-Embedder-Policy` 配置可用，避免大文件流式场景失效。
- 修改安装流程时，确保根目录 `postinstall` 仍能正确安装 `example/test-fast-md5`，并支持 `FAST_MD5_WEB_SKIP_EXAMPLE_INSTALL=1` 跳过安装。

## 执行步骤

1) 先判断需求边界属于库入口（`src/index.ts`）、Worker（`src/md5-worker.ts`）、WASM 核心（`wasm/src/lib.rs`）、示例与 e2e（`example/test-fast-md5/*`）或安装脚本（`scripts/postinstall.mjs`）。
2) 识别复杂性来源（消息协议耦合、并发控制、内存分配、回退逻辑、构建链路），确定最小且有效的改造目标。
3) 先改接口与抽象，再改实现；优先让常见场景（小文件、批量计算、默认参数）保持简单。
4) 小步增量改造：每次变更只解决一类核心复杂性，避免同时改动 TS、WASM、示例与测试的多个高风险点。
5) 改造完成后补齐必要测试，并更新结构映射或依赖映射文档。

## 质量门禁（必须执行）

- 根目录质量检查：
  - `pnpm run lint`
  - `pnpm run type-check`
  - `pnpm run format:check`
- 构建验证（代码或构建链路有改动时）：
  - `pnpm run build`

## 测试验收（必须执行）

- 根目录统一测试命令：
  - `pnpm run test`（Vitest 单元测试 + Playwright e2e）
  - `pnpm run test:unit`（仅 Vitest 单元测试）
  - `pnpm run test:e2e`（仅 Playwright e2e）
  - `pnpm run test:hook`（commit hook 使用的统一测试入口）
- 大文件测试基线：
  - 大文件场景最小体积使用 `>=300MB`，覆盖单文件与多大文件批量路径。
- 首次在新环境运行 e2e 时：
  - `pnpm --dir example/test-fast-md5 run test:e2e:install-browser`
- 仅验证示例工程时：
  - `pnpm --dir example/test-fast-md5 run test:e2e`
- Git commit hook（`.husky/pre-commit`）必须执行：
  - `pnpm run test:unit`
  - `pnpm run test:e2e`

## 需要时加载的参考（加载关键词：`《软件设计的哲学》`）

- `references/global-prompt.md`: 项目全局角色设定、警示信号与设计原则。
