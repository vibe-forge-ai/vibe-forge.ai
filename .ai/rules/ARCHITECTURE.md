---
alwaysApply: true
description: 仓库基础架构总览，说明分层、依赖边界、运行链路与 server 职责分工。
---

# 架构说明

本文件是架构入口页，只保留总览与阅读顺序；细节继续下钻到 `architecture/`。

## 先看这些

- [模块拆分](./architecture/module-organization.md)：模块怎么继续拆，以及代码到底该落在模块内、应用内还是共享层。
- [包分层](./architecture/layers.md)：各层职责和 package 归属。
- [依赖关系](./architecture/dependencies.md)：主干依赖与扩展实现关系。
- [启动链路](./architecture/runtime-flows.md)：`vf`、`vf-mcp`、`vf-call-hook` 与默认 MCP。
- [Server 约定](./architecture/server.md)：传输层、services、db 的职责边界。

## 核心边界

- `apps/*` 是入口层，不重复实现共享 runtime。
- `apps/client` 只依赖共享契约和展示元数据，不直接触达文件系统和任务运行时。
- `apps/cli` 与 `apps/server` 复用 `@vibe-forge/app-runtime` 暴露的 task / benchmark 入口。
- 共享 contract、schema、公共类型优先放在 `packages/types` 或 `packages/core`。
- adapter、plugin、channel 是扩展实现层，不承担新的业务编排职责。
- Server 内部按 `routes/websocket/channels -> services -> db` 分层，不把状态和 SQL 散落到传输层。

## 继续阅读

- [本仓库开发与贡献](./DEVELOPMENT.md)
- [通用 Hooks 方案](./HOOKS.md)
- [Benchmark 技术方案](./BENCHMARK.md)
- [当前重构待办](./REFACTOR-TODO.md)
