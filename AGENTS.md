# fast-md5-web — Agent Collaboration Guide

Unified project context, skill-loading protocol, and collaboration guidelines for all AI agents (Claude Code, Cursor, Windsurf, Copilot, and general-purpose LLM agents).

---

## 1. Project Overview

**fast-md5-web** is a high-performance browser-side MD5 hashing library built on WebAssembly + Web Workers.

Core architecture:
- **Main thread** (`src/index.ts`): `Md5CalculatorPool` — worker pool, task queue, concurrency control
- **Worker thread** (`src/md5-worker.ts`): message handling and WASM invocation
- **WASM core** (`wasm/src/lib.rs`): Rust MD5 algorithm implementation
- **Example app** (`example/test-fast-md5/`): Vue + Vite integration demo with Playwright e2e

Data flow: Main thread → Worker pool dispatch → WASM computation → Result callback

---

## 2. Skill Catalog

The project maintains structured AI skill packs under `skills/`. Each skill contains a `SKILL.md` (main instructions), `references/` (supporting docs), and optionally `agents/` (agent interface config).

### Available Skills

| Skill | Path | Trigger Scenarios |
|-------|------|-------------------|
| **Code Review Expert** | `skills/code-review-expert/SKILL.md` | Code review, PR review, security scan, SOLID checks |
| **Software Design Philosophy** | `skills/software-design-philosophy/SKILL.md` | Module design, API complexity, refactoring, architecture review |
| **Project Spec** | `skills/fast-md5-web-project-spec/SKILL.md` | Feature development, interface refactoring, quality gates, test acceptance |
| **Project Structure** | `skills/fast-md5-web-project-structure/SKILL.md` | Path lookup, module navigation, dependency management, build pipeline |

### Skill-Loading Protocol

Agents should proactively load the appropriate `SKILL.md` based on user intent and task type.

1. **Code review** — When the user requests a review, audit, security check, or pre-PR validation:
   - Load `skills/code-review-expert/SKILL.md`
   - Load checklists from `references/` as needed

2. **Design & refactoring** — When the user mentions module design, API complexity, shallow modules, complexity management, or references *A Philosophy of Software Design*:
   - Load `skills/software-design-philosophy/SKILL.md`
   - Load design principle docs from `references/` as needed

3. **Feature development & quality verification** — When the user works on features, interface refactoring, performance optimization, or needs quality gate confirmation:
   - Load `skills/fast-md5-web-project-spec/SKILL.md`
   - Always read `references/global-prompt.md` first as the global prompt

4. **Path lookup & structure navigation** — When the user asks "where is this file", "which module to modify", "dependency relationships", or makes cross-module changes:
   - Load `skills/fast-md5-web-project-structure/SKILL.md`
   - Read `references/project-structure.md` first for entry-point mapping

**Combined loading**: Complex tasks may require multiple skills. For example, a refactoring task should load Design Philosophy + Project Spec + Project Structure together.

---

## 3. Project Constraints

### Architecture Boundaries

- **ESM-only**: Do not introduce CommonJS compatibility branches — avoid build/runtime behavior divergence
- **WASM artifacts**: `wasm/pkg/*` are generated — modify `wasm/src/*` then rebuild
- **SharedArrayBuffer**: When changing `Md5CalculatorPool` or Worker message protocol, verify both the SharedArrayBuffer path and message-passing fallback path
- **COOP/COEP**: When modifying `example/test-fast-md5`, keep cross-origin isolation policy configuration functional
- **postinstall**: When modifying the install flow, ensure the root `postinstall` works correctly and supports `FAST_MD5_WEB_SKIP_EXAMPLE_INSTALL=1` to skip

### Quality Gates (Required After Code Changes)

```bash
pnpm run lint          # ESLint checks
pnpm run type-check    # TypeScript type checking
pnpm run format:check  # Prettier format checking
pnpm run build         # Build verification (when code or build pipeline changes)
```

### Test Acceptance

```bash
pnpm run test          # Full: Vitest unit tests + Playwright e2e
pnpm run test:unit     # Vitest unit tests only
pnpm run test:e2e      # Playwright e2e only
pnpm run test:hook     # Commit hook entry point
```

- Large-file test baseline: >= 300MB, covering single-file and multi-file batch paths
- First-time e2e setup: `pnpm --dir example/test-fast-md5 run test:e2e:install-browser`
- Git hook (`.husky/pre-commit`) runs `pnpm run test:hook`

### Change Impact Map

| Change Scope | Affected Files | Required Verification |
|--------------|---------------|----------------------|
| Public API / pool logic | `src/index.ts` | Unit tests + e2e |
| Worker message protocol | `src/index.ts` + `src/md5-worker.ts` | Unit tests + e2e |
| Rust computation logic | `wasm/src/lib.rs` | `pnpm run build` + full test suite |
| Example & e2e | `example/test-fast-md5/*` | e2e tests |

---

## 4. Coding Standards

### Design Principles

Follow the core principles from *A Philosophy of Software Design* (see `skills/software-design-philosophy/SKILL.md` for details):

- Modules should be deep: simple interface, powerful implementation
- Information hiding: encapsulate design decisions within a single module
- General-purpose over special-purpose: find the simplest interface that covers all current needs
- Strategic programming: invest 10-20% extra effort in design improvement

### Development Workflow

1. **Identify boundaries**: Determine whether the requirement belongs to the library entry, Worker, WASM core, example app, or utility scripts
2. **Diagnose complexity**: Locate complexity sources (message protocol coupling, concurrency control, memory allocation, fallback logic, build pipeline)
3. **Interface first, then implementation**: Modify interfaces and abstractions before changing implementations
4. **Incremental changes**: Each change addresses only one class of core complexity
5. **Quality verification**: Run quality gates and test acceptance after each change

---

## 5. Skill Extension Guide

When adding a new skill, follow this structure:

```
skills/<skill-name>/
├── SKILL.md                 # Main instruction file (required)
├── README.md                # Skill description (optional)
├── agents/
│   └── agent.yaml           # Agent interface config (optional)
└── references/              # Supporting documents (optional)
    └── *.md
```

After adding a new skill, update:
1. This file (`AGENTS.md`) — add to skill catalog
2. `.claude/skills.md` — add loading entry for Claude Code
3. `.agents/skills.md` — add loading entry for general agents
