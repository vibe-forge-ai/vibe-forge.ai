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

### Worktree 启动补充

- 当前 worktree 如果没有本地 `.env` / `.env.dev`，runtime 会回退读取主 worktree 的对应文件。
- 当前 worktree 如果没有本地 `.ai.dev.config.json` / `.ai.dev.config.yaml`，config loader 会回退读取主 worktree 的 dev config。
- 回退依据是 Git common dir，也就是和当前 worktree 绑定的主仓库；这样可以避免每次新建 worktree 都重复复制本地私有配置。
- 如果当前 worktree 有自己的 `.env` 或 `.ai.dev.config.*`，优先使用当前 worktree 的文件，不会被主 worktree 覆盖。
- 如果主 worktree 也没有这些本地文件，仍然需要你自己补齐，或者显式导出所需环境变量。
- 新建或切换到 worktree 后，先在当前 worktree 根目录执行一次 `pnpm install`，不要复用别的 worktree 的依赖状态。
- `start.sh` 启动前会先做只读的 workspace 安装校验；如果当前 worktree 缺少 `node_modules` 状态文件或 workspace 链接，会直接报错并要求先执行 `pnpm install`。
- 在 Codex worktree 中开发时，优先先切到一个和当前主线任务一致的分支名；不要长期停留在 detached HEAD，也不要为顺手修的小点单独起支线分支名。
- 开发态前端标题会显示当前 git ref，用来区分多个 worktree；如果刚切了分支，需要重启 `start.sh` 后再刷新页面，标题才会更新。

### Worktree 启动前检查

- 确认主 worktree 的 `.ai.dev.config.json` 里引用的 model service / adapter 配置仍然有效。
- 确认主 worktree 的 `.env` 里存在对应密钥，例如 `BYTE_DANCE_GPT_API_KEY`、`BYTE_DANCE_ARK_API_KEY`。
- 如果刚修改了 `.env` 或 `.ai.dev.config.*`，要重启后端进程；只刷新前端页面不会让子进程重新加载配置。
- `start.sh` 会在启动前检查 server 端口；如果默认端口已被其他 worktree 的 server 占用，TTY 环境下会提示是否切换到下一个可用端口，非交互环境则直接报错并给出建议端口。

### Worktree 进程与配置串线排查

- 如果当前 worktree 的 provider / adapter 行为和代码、配置不一致，先怀疑连到了别的 worktree 的旧进程，而不是先改业务逻辑。
- 先核对 `/api/config` 是否反映当前 worktree 预期的 `defaultModelService`、`defaultModel` 和 adapter 配置。
- 再核对本地 router / mock / adapter 子进程端口是否属于当前 workspace；多个 worktree 共用固定端口时很容易串线。
- 发现重复实例时，先停掉旧实例，再重启当前 worktree 的 server / router；只刷新前端通常修不好。

### 真实 Chrome 调试补充

- 交互、浮层、focus 和样式问题必须在真实 Chrome 中验证 `computed style`、popup open state 和 `activeElement`，不要只看 SCSS、截图或单测。
- 调整 tooltip / popover / theme / 全局 token 后，先 reload 页面再采样；隐藏浮层节点和旧 bundle warning 很容易误导判断。
- 读取 console warning 时，最好在页面 load 完成后重新采样；否则可能读到上一版代码的残留告警。
- 出现颜色或状态回归时，先对照 `git diff` 或最近可用提交，不要凭印象猜 token。

## 代码质量

常用命令：

```bash
pnpm exec eslint .
pnpm exec dprint check
pnpm exec dprint fmt
pnpm typecheck
pnpm tools message-actions verify
pnpm tools commitmsg-check <base> <head>
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
- definition 领域共享语义层：`packages/definition-core/src/index.ts`
  - 包含名称/标识/摘要解析、rule reference 语义与 remote rule 投影
- 定义文档加载层：`packages/definition-loader/src/index.ts`
  - 包含 rules / skills / specs / entities 的发现、读取与解析
- workspace asset 层：`packages/workspace-assets/src/index.ts`
  - 包含 workspace bundle、prompt asset 选择、prompt 组装和 adapter asset plan
- app-facing runtime facade：`packages/app-runtime/src/index.ts`
- 任务执行层：`packages/task/src/index.ts`
- Benchmark 领域层：`packages/benchmark/src/index.ts`

## 数据库结构

- 入口与实例：`apps/server/src/db/index.ts`（导出 `getDb()`）。
- 表结构与迁移：`apps/server/src/db/schema.ts`。
- 领域读写：`apps/server/src/db/*.repo.ts`。
- 自动化子域：`apps/server/src/automation/db/`。
