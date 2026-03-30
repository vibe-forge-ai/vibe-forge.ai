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

发布前先明确范围，不要直接把所有最近提交等价成“都要发布”：

- 先以最近一次版本更新或发布提交为基线做 diff，确认这段时间哪些 workspace 包真的发生了变化。
- 只有运行时代码变更、发布元数据变更（如 `package.json` version / exports / deps）才应计入发版范围。
- 纯测试、snapshot、AGENTS、普通文档改动默认不进入发版范围，也不应因此级联发布依赖方。
- 如果某个包本身不发布，就不要因为它的测试改动把依赖闭包上的上层包一起带入发布计划。

单包发布与整体发布分开处理：

- 整体发布：通常发布一组 public workspace 包，并在 `changelog/<version>/readme.md` 记录。
- 单包发布：只发布明确选中的包，并在 `changelog/<version>/<package>.md` 记录。
- 同一个版本目录下可以同时存在多个单包发布记录，例如 `client.md`、`server.md`。

发布前建议执行的检查：

- 用 `pnpm tools publish-plan -- ...` 先确认发布顺序和候选包。
- 用 `npm view <pkg> version` 确认 registry 当前版本，避免重复发已存在版本。
- 用 `npm whoami` 确认当前 npm 登录态。
- 在目标包目录执行 `npm pack --dry-run` 检查最终打包内容。

发布后的记录约定：

- 整体发布 tag 使用 `v<version>`。
- 单包发布 tag 使用 `pkg/<normalized-package-name>/v<version>`。
- `normalized-package-name` 规则见 `changelog/AGENTS.md`。
- 具体的单包发布检查清单见 `scripts/AGENTS.md`；changelog 记录方式见 `changelog/AGENTS.md`。

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
