# 启动链路

返回入口：[ARCHITECTURE.md](../ARCHITECTURE.md)

## `vf run`

1. `apps/cli/cli.js`
2. `@vibe-forge/cli-helper/loader`
3. `apps/cli/src/cli.ts`
4. `apps/cli/src/commands/run.ts`
5. `@vibe-forge/app-runtime.generateAdapterQueryOptions()`
6. `@vibe-forge/app-runtime.run()`
7. `packages/task/src/prepare.ts`
8. `@vibe-forge/config`、`@vibe-forge/utils`、`@vibe-forge/definition-loader`、`@vibe-forge/definition-core`、`@vibe-forge/workspace-assets` 完成 config、logger、definition 文档、definition 语义、workspace assets 与默认 MCP 装配
9. adapter query

## `vf-mcp`

1. `packages/mcp/cli.js`
2. `@vibe-forge/cli-helper/loader`
3. `packages/mcp/src/cli.ts`
4. `packages/mcp/src/command.ts`
5. `packages/mcp/src/tools/*`
6. `@modelcontextprotocol/sdk` stdio server

默认会带上 `StartTasks` / `GetTaskInfo` / `StopTask` / `ListTasks` 这组 task 工具。

## `vf-call-hook`

1. `packages/hooks/call-hook.js`
2. `packages/hooks/src/entry.ts`
3. 优先加载当前 active adapter 的 `./hook-bridge`
4. 未命中时回退 `packages/hooks/src/runtime.ts`
5. runtime 通过 `@vibe-forge/config` 读取配置，通过 `@vibe-forge/utils` 处理 logger、log level 与输入转换
6. plugin middleware 链

## 默认内建 MCP

- `task prepare` 会把内建 `VibeForge` MCP server 作为 fallback MCP asset 注入到 workspace bundle。
- 关键实现位置：
  - `packages/config/src/default-vibe-forge-mcp.ts`
  - `packages/task/src/prepare.ts`
- 它本质上是 `process.execPath + <resolved @vibe-forge/mcp>/cli.js` 的本地 stdio server。

## 关闭方式

优先级从高到低：

1. 运行参数 `useDefaultVibeForgeMcpServer`
2. 配置 `noDefaultVibeForgeMcpServer`
3. 默认值 `true`

CLI 开关：`vf run --no-default-vibe-forge-mcp-server`
