# MCP 包说明

`@vibe-forge/mcp` 提供独立的 MCP stdio server，以及 `vf-mcp` / `vibe-forge-mcp` 二进制入口。

## 什么时候先看这里

- `vf-mcp` 启动失败
- MCP tool 注册、过滤、分类行为异常
- `StartTasks` / `ListTasks` / `AskUserQuestion` 行为异常
- 想确认独立 MCP CLI 与 core / server 的依赖边界

## 入口

- `cli.js`
  - 独立 CLI 壳，补齐工作区环境并转交给共享 loader
- `src/cli.ts`
  - standalone `vf-mcp` commander 入口
- `src/command.ts`
  - MCP options / stdio server 启动逻辑
- `src/tools/*`
  - MCP tool 注册与实现
- `src/tools/task/manager.ts`
  - MCP task tools 的运行时主逻辑
  - 直接引用 `@vibe-forge/task`、`@vibe-forge/hooks`、`@vibe-forge/config` 和 `src/sync.ts`
- `src/sync.ts`
  - 与 Vibe Forge server 的 session 同步 HTTP API

## 边界约定

- CLI loader 统一走 `@vibe-forge/cli-helper/loader`
- `@vibe-forge/mcp` 直接引用本包内需要的 task / hook / prompt / sync 模块，不再通过额外 bindings 装配层传递上下文
- `task` 类工具默认启用
- MCP tool 实现集中在本包

## 相关文档

- [架构说明](/Users/bytedance/projects/vibe-forge.ai/.ai/rules/ARCHITECTURE.md)
- [使用文档入口](/Users/bytedance/projects/vibe-forge.ai/.ai/docs/index.md)
- [使用文档边界约定](/Users/bytedance/projects/vibe-forge.ai/.ai/rules/USAGE.md)
- [CLI 维护说明](/Users/bytedance/projects/vibe-forge.ai/apps/cli/src/AGENTS.md)
