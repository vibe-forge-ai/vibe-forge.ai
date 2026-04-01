---
alwaysApply: false
description: 当任务涉及本仓库开发、启动本地环境、执行测试或定位各 package 入口时加载的开发说明。
---

# 本仓库开发与贡献

本文件只描述如何参与本仓库开发；如何把 Vibe Forge 接入你的项目，请见 [USAGE.md](./USAGE.md)。

## 开发环境

- Node.js：建议 v18+
- pnpm：建议 v8+

## 本地启动（UI）

在仓库根目录：

```bash
pnpm install
pnpm start
```

该命令等价于运行 [start.sh](../../start.sh)，会分别启动：

- `npx vfui-server`（后端）
- `npx vfui-client`（前端）

日志输出到 `.logs/`。

## 代码质量

常用命令：

```bash
npx eslint .
npx dprint fmt
pnpm -r exec tsc --noEmit
pnpm -C apps/cli test
pnpm -C packages/hooks test
pnpm -C packages/mcp test
pnpm test:e2e:adapters
pnpm tools adapter-e2e run codex
pnpm tools adapter-e2e test codex-read-once --update
npx vf-mcp --help
pnpm tools publish-plan -- --help
npx vitest run <path>
```

## 发布实践

所有发布相关规则统一维护在 [RELEASE.md](./RELEASE.md)：

- 发布范围判断
- 单包发布与整体发布
- publish-plan 使用
- changelog 记录方式
- tag 约定
- 发布前后检查与经验沉淀

## 项目规范

- 架构说明：[ARCHITECTURE.md](./ARCHITECTURE.md)
- 重构待办：[REFACTOR-TODO.md](./REFACTOR-TODO.md)
- CLI 维护说明：[`apps/cli/src/AGENTS.md`](../../apps/cli/src/AGENTS.md)
- Types 维护说明：[`packages/types/AGENTS.md`](../../packages/types/AGENTS.md)
- App Runtime 维护说明：[`packages/app-runtime/AGENTS.md`](../../packages/app-runtime/AGENTS.md)
- Definition Loader 维护说明：[`packages/definition-loader/AGENTS.md`](../../packages/definition-loader/AGENTS.md)
- Workspace Assets 维护说明：[`packages/workspace-assets/AGENTS.md`](../../packages/workspace-assets/AGENTS.md)
- Task 维护说明：[`packages/task/AGENTS.md`](../../packages/task/AGENTS.md)
- Benchmark 维护说明：[`packages/benchmark/AGENTS.md`](../../packages/benchmark/AGENTS.md)
- Config 维护说明：[`packages/config/AGENTS.md`](../../packages/config/AGENTS.md)
- Utils 维护说明：[`packages/utils/AGENTS.md`](../../packages/utils/AGENTS.md)
- Hooks 维护说明：[`packages/hooks/AGENTS.md`](../../packages/hooks/AGENTS.md)
- MCP 维护说明：[`packages/mcp/AGENTS.md`](../../packages/mcp/AGENTS.md)
- Hooks 文档：[HOOKS.md](./HOOKS.md)
- 共享类型层：`packages/types/src/*`
  - 包含 `Config`、adapter contract / loader、MCP contract、session / websocket 等共享类型
- 通用配置层：`packages/config/src/index.ts`
  - 包含 `defineConfig()`、config loader、config writer、默认 system prompt helper
- 通用工具层：`packages/utils/src/index.ts`
  - 包含 logger、log-level、document-path、uuid、chat-message、cache 和 system helper
- 定义文档加载层：`packages/definition-loader/src/index.ts`
  - 包含 rules / skills / specs / entities 的发现、读取与 prompt 片段生成
- workspace asset 层：`packages/workspace-assets/src/index.ts`
  - 包含 workspace bundle、prompt asset 选择和 adapter asset plan
- app-facing runtime facade：`packages/app-runtime/src/index.ts`
- 任务执行层：`packages/task/src/index.ts`
- Benchmark 领域层：`packages/benchmark/src/index.ts`

## 数据库结构

- 入口与实例：`apps/server/src/db/index.ts`（导出 `getDb()`）。
- 表结构与迁移：`apps/server/src/db/schema.ts`。
- 领域读写：`apps/server/src/db/*.repo.ts`。
- 自动化子域：`apps/server/src/automation/db/`。
