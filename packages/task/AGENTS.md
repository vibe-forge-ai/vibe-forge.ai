# Task 包说明

`@vibe-forge/task` 承载任务执行 runtime。

## 什么时候先看这里

- `vf run` 或 server session 的主流程异常
- adapter query options、workspace assets、skills / rules / entities / specs prompt 生成不对
- 被 MCP task 工具复用的任务执行行为异常
- 想确认任务运行时和 `types` / `workspace-assets` / `hooks` / `mcp` 的职责边界

## 入口

- `src/run.ts`
  - 任务主运行入口
  - 负责 session 生命周期编排、adapter 执行与 native/bridge 去重
- `src/prepare.ts`
  - 运行前装配
  - 负责 config、logger、workspace assets、默认内建 MCP 与 runtime 输入归并
- `src/generate-adapter-query-options.ts`
  - 负责把 CLI / server 输入转换成 adapter query options
- `__tests__/run.spec.ts`
- `__tests__/generate-adapter-query-options.spec.ts`

## 边界约定

- `@vibe-forge/task` 负责任务执行，不负责 CLI 命令注册
- `@vibe-forge/task` 直接依赖 `@vibe-forge/types`、`@vibe-forge/workspace-assets`、`@vibe-forge/hooks`、`@vibe-forge/config`、`@vibe-forge/utils`
- app-facing task 入口通过 `@vibe-forge/app-runtime` 暴露
- 默认 system prompt 的开关解析与合并策略、默认内建 MCP 解析位于 `@vibe-forge/config`
- definition loader 位于 `@vibe-forge/definition-loader`
- cache 位于 `@vibe-forge/utils`
- hooks runtime 仍在 `@vibe-forge/hooks`
- MCP stdio server 仍在 `@vibe-forge/mcp`
