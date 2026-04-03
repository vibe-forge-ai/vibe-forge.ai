---
alwaysApply: true
description: 仓库通用维护与验证规则，包含启动、lint、格式化、类型检查、测试与常见维护入口。
---

# 项目维护指南 (Maintenance)

本文件保留常用维护入口；日志消费与排查经验见：

- [日志消费与排查](./maintenance/logs.md)
- [消息级操作开发经验](./maintenance/message-actions.md)
- [消息级操作维护工具](./maintenance/tooling.md)

## 开发环境启动

在根目录下运行：

- `pnpm dev`: 同时启动前端和后端（需配置对应的并行脚本，或分别在各目录下运行）。
- 后端启动: `cd apps/server && pnpm dev` (支持热重载)。
- 前端启动: `cd apps/client && pnpm dev` (支持 HMR)。

## 常见维护任务

### 0. 代码质量检查与格式化 (Tooling)

在进行任何提交或重大修改前，应运行以下指令确保代码质量：

- **Lint 检查**: `pnpm exec eslint .`
  - 场景：检查代码风格、潜在错误和类型安全（如 `strict-boolean-expressions`）。
  - 注意：项目使用 `@antfu/eslint-config`，对 `Promise` 处理、`any` 使用和显式空值检查有严格要求。
- **格式检查**: `pnpm exec dprint check`
  - 场景：在 CI 或提交前校验格式是否已按 `dprint.json` 对齐。
- **代码格式化**: `pnpm exec dprint fmt`
  - 场景：统一代码格式。
- **类型检查**: `pnpm typecheck`
  - 场景：在重构或修改共享包 (`packages/core`) 后，确保全量类型安全。
- **提交信息检查**: `pnpm tools commitmsg-check <base> <head>`
  - 场景：在 CI 中校验一个 commit range 内的提交标题是否符合 Conventional Commit 约定；GitHub merge commit 例外。
- **消息级操作回归**: `pnpm tools message-actions verify`
  - 场景：修改消息级 `编辑 / 撤回 / 分叉 / 复制原文` 后，固定跑一遍质量检查与回归测试组合，并拿到真实 Chrome 回归清单。
- **单元测试**: `pnpm -C apps/client test` / `pnpm -C apps/cli test` / `npx vitest run <path>`
  - 场景：修改核心逻辑或 API 适配器后验证功能正确性。
  - 注意：运行单个用例或目录时需使用 `vitest run <path>`，不要直接执行 `vitest <path>`。
  - 说明：`vitest run` 支持文件路径与 glob，例如 `npx vitest run apps/cli/__tests__/*.spec.ts`。
  - Vitest 配置：仓库根使用 `vitest.workspace.ts` 作为 workspace 配置文件（不再使用 `vitest.config.ts`）。
  - workspace 划分：`node` / `bundler` / `bundler.web` 三个 project 的 include 规则来自 `packages/tsconfigs` 下对应的 `*.test.json`：
    - `node`: `tsconfig.node.test.json`
    - `bundler`: `tsconfig.bundler.test.json`
    - `bundler.web`: `tsconfig.bundler.web.test.json`
  - 维护方式：新增/移动测试文件时，优先调整对应 `tsconfig.*.test.json` 的 `include`，避免在 Vitest 配置里手写路径。

### 1. 修改后端 API

- 路由定义位于 `apps/server/src/routes/`。
- 如果涉及数据模型变更，请同步更新 `apps/server/src/db/schema.ts` 的表结构与迁移逻辑，并在对应的 Repo 中调整读写逻辑。
- 自动化相关的数据结构与读写逻辑位于 `apps/server/src/automation/db/`。

### 2. 修改前端样式

- 样式文件采用 `.scss`，与组件同名（PascalCase）放置在 `src/components/` 下。
- 全局样式位于 `src/styles/global.scss`。

### 3. 环境参数配置

- 环境变量通过 `.env` 文件或 shell 传入。
- 后端参数参考 `apps/server/src/env.ts`，如 `DB_PATH` 可用于指定数据库存储位置。
- 前端参数以 `VITE_` 开头，参考 `apps/client/src/vite-env.d.ts`。

### 4. 更新国际化文本

- 中文文本修改：编辑 `apps/client/src/resources/locales/zh.json`。
- 英文文本修改：编辑 `apps/client/src/resources/locales/en.json`。
- 如果添加了新的 Key，请确保在两个文件中都进行添加，以保证多语言支持的完整性。

## 注意事项

- **持久化**: 数据库文件默认存储在 `~/.vf/db.sqlite`，可以使用标准的 SQLite 客户端进行查看和维护。
- **SQLite 运行时**: Server 侧数据库已切换为 Node.js 内置的 `node:sqlite`，运行环境需使用支持该模块的 Node.js 22.5+。
- **类型安全**: 共享类型建议在各自目录的 `types.ts` 中定义，保持前后端接口定义一致。
