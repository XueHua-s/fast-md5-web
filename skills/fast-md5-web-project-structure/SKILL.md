---
name: fast-md5-web-project-structure
description: "fast-md5-web 项目结构与模块地图。用于定位代码、理解 TypeScript 库入口与 Worker 协作、Rust WASM 编译链路、example/test-fast-md5 测试应用边界、选择正确 package.json 与脚本目标，或在目录迁移后同步路径映射时。"
---

# fast-md5-web 项目结构技能

## 快速开始

- 先读 `references/project-structure.md` 获取入口、模块边界与关键链路映射。
- 需要选型时读 `references/dependencies.md`，优先复用现有依赖与封装。
- 用户提到“目录变更/路径失效/找不到文件/不确定改哪个模块”时，先执行 `rg --files src wasm example/test-fast-md5 __test scripts docs` 做路径自检。

## 导航原则

- 先判断模块边界：`src`（公共 API 与线程池）、`wasm`（Rust 计算核心）、`example/test-fast-md5`（示例与 e2e）、`__test`（单元测试）、`scripts`（安装与工具脚本）。
- 先找入口再追深模块：`src/index.ts`、`src/md5-worker.ts`、`wasm/src/lib.rs`、`example/test-fast-md5/src/main.ts`。
- 公共能力通过 `src/index.ts` 暴露；Worker 只负责消息处理与 WASM 调用；Hash 算法逻辑集中在 `wasm/src/lib.rs`。
- 构建链路优先看根目录 `package.json`、`tsup.config.ts`、`wasm/Cargo.toml` 与 `example/test-fast-md5/package.json`。
- 涉及大文件流式能力时，优先核对 SharedArrayBuffer 条件与 `example/test-fast-md5/vite.config.ts` 的 COOP/COEP 配置。

## 执行步骤

1) 判断需求属于哪个模块与哪个脚本目标（`build`、`test`、`test:unit`、`test:e2e`、`build:wasm`）。
2) 路径不确定时先做目录自检并确认关键入口文件存在。
3) 从入口沿调用链追踪到具体模块，不在未确认目录下盲改。
4) 增删依赖前先确认目标 `package.json` 或 `wasm/Cargo.toml` 所属模块。
5) 若发现目录变更，先同步更新 `references/project-structure.md` 与 `references/dependencies.md` 再继续实现。

## 质量命令选择

- 根目录质量检查：
  - `pnpm run lint`
  - `pnpm run type-check`
  - `pnpm run format:check`
- 构建验证（改动 `src/*` 或 `wasm/*` 时）：
  - `pnpm run build`
- 示例工程快速构建验证（改动 `example/test-fast-md5/*` 时）：
  - `pnpm --dir example/test-fast-md5 run build`

## 测试命令选择

- 根目录统一测试：
  - `pnpm run test`（Vitest + Playwright）
  - `pnpm run test:unit`（Vitest）
  - `pnpm run test:e2e`（Playwright）
  - `pnpm run test:hook`（commit hook 专用入口）
- 示例工程专项测试：
  - `pnpm --dir example/test-fast-md5 run test:e2e`
  - 首次运行时先执行 `pnpm --dir example/test-fast-md5 run test:e2e:install-browser`
- Git commit hook 路径：
  - `.husky/pre-commit`（会执行 `pnpm run test:hook`）

## 需要时加载的参考

- `references/project-structure.md`: 目录、入口、构建链路与改动映射。
- `references/dependencies.md`: 依赖落点、用途与复用建议。
