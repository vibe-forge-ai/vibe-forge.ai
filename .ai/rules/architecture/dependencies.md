# 架构依赖

返回入口：[ARCHITECTURE.md](../ARCHITECTURE.md)

## 主干关系

```mermaid
flowchart LR
  CLI["apps/cli"] --> Helper["packages/cli-helper"]
  CLI --> AppRuntime["packages/app-runtime"]
  CLI --> Hooks["packages/hooks"]
  CLI --> Core["packages/core"]

  Server["apps/server"] --> AppRuntime
  Server --> Core
  Server --> Config["packages/config"]
  Server --> DefinitionLoader["packages/definition-loader"]
  Server --> Utils["packages/utils"]

  Client["apps/client"] --> Core

  AppRuntime --> Task["packages/task"]
  AppRuntime --> MCP["packages/mcp"]
  AppRuntime --> Benchmark["packages/benchmark"]

  Task --> WorkspaceAssets["packages/workspace-assets"]
  Task --> Hooks
  Task --> Config
  Task --> Utils
  Task --> Types["packages/types"]

  MCP --> Task
  MCP --> Hooks
  MCP --> Config

  Hooks --> Config
  Hooks --> Utils
  Hooks --> Types

  Core --> Types
  Core --> Utils
```

## 依赖方向

- 应用层依赖 runtime / core，不反向。
- `task` 是 adapter 的运行时入口；adapter 由运行时解析，不让 app 直接编排。
- `hooks`、`mcp`、`benchmark` 共享 `config` / `utils` / `types`，避免各自复制协议。
- `workspace-assets`、`definition-loader` 是 task 侧的领域支撑层。

## 扩展实现

- `channels/*`：由 Server / Client 消费 channel contract。
- `adapters/*`：由 `task` 在运行时按包名解析。
- `plugins/*`：由 `hooks` 在运行时装载。
