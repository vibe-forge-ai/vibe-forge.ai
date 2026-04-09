# Repo Reading Guide

开始处理仓库前，先读 `.ai/rules/` 下 `alwaysApply: true` 的基础规则与维护文档；其他文档按任务结合 `description` / `globs` 按需继续阅读。

优先阅读：

- `.ai/rules/CODING-STYLE.md`
- `.ai/rules/ARCHITECTURE.md`
- `.ai/rules/MAINTENANCE.md`

按任务继续阅读：

- adapter runtime / mock home / 原生资产自动适配：`.ai/rules/ADAPTERS.md`
- 前端 / 后端约束：`.ai/rules/FRONTEND-STANDARD.md`、`.ai/rules/BACKEND-STANDARD.md`
- 仓库开发与贡献：`.ai/rules/DEVELOPMENT.md`
- 项目接入方式：`.ai/rules/USAGE.md`
- hooks 方案与维护：`.ai/rules/HOOKS.md`、`.ai/rules/HOOKS-REFERENCE.md`
- benchmark 方案与规划：`.ai/rules/BENCHMARK.md`、`.ai/rules/BENCHMARK-PLAN.md`
- 当前重构待办：`.ai/rules/REFACTOR-TODO.md`
- 发布与更新日志：`changelog/`

前端任务补充：

- 只要任务涉及 `apps/client` 的页面交互、样式、浮层、focus、主题、热更新、真实 Chrome 回归或 CDP 调试，除了 `.ai/rules/FRONTEND-STANDARD.md`，还必须继续阅读 `.ai/rules/frontend-standard/debugging.md`。
- 如果改动范围落在 `apps/client/`，还应继续阅读 `apps/client/AGENTS.md`；如果涉及聊天页 / sender / 消息级交互，再继续阅读 `apps/client/src/components/chat/AGENTS.md`。

维护约定：

- 以 `.ai/rules/` 为统一文档入口，不再以仓库根 `docs/` 作为主入口。
- 顶层文件只做总览与导航；超过一屏的细节继续拆到同名子目录，保持渐进式披露。
- 更新日志统一维护在仓库根目录 `changelog/`，按版本目录组织。
- 如果通过 worktree 切换到新副本，先确认本地私有配置与依赖已经就位，例如 `.ai.dev.config.json`、`.env`，并在当前 worktree 根目录执行一次 `pnpm install`。
- AGENTS 与文档只描述现状，不记录迁移历史。
