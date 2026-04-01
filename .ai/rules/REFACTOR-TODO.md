# 重构待办

本文件只记录当前仍然明确存在的架构治理事项，不记录已完成的迁移历史。

## 高优先级

- `schema` 继续下沉到底层共享包
  - 当前很多 schema 仍然留在运行时包里，例如 benchmark 的 [schema.ts](/Users/bytedance/projects/vibe-forge.ai/packages/benchmark/src/schema.ts)
  - 目标是让 `@vibe-forge/types` 承载共享 contract 与 schema，运行时包只保留实现和 orchestration
- `workspace-assets` 继续收敛成纯 asset 实现层
  - 当前 contract 已大幅下沉到 `@vibe-forge/types`
  - definition loader 已独立到 `@vibe-forge/definition-loader`
  - 后续优先检查 prompt asset 选择与 adapter asset plan 是否还值得继续拆层
- cache 的文件存储原语继续收敛
  - 当前 cache 已下沉到 `@vibe-forge/utils`
  - 后续可以继续检查是否值得把 JSON 文件存储原语和 task cache 路径约定拆开
- `benchmark` 继续拆分 schema 与 runtime
  - 当前 benchmark 共享类型已下沉到 `@vibe-forge/types`
  - 但 schema 仍在 `@vibe-forge/benchmark`

## 中优先级

- 继续检查各应用层包是否误依赖运行时包
  - 原则是 `apps/client` 这类 UI 包只依赖共享 contract，不依赖运行逻辑包
- 继续收紧 `core` 的职责
  - 保持 `core` 只承载公共 API 壳，不回流业务编排逻辑
- 为 Claude / Codex 补齐原生插件兼容层
  - 当前 npm 插件的共享资产层已经可被 `claude-code`、`codex`、`opencode` 共同消费
  - 但原生插件生态兼容目前只有 `opencode` 已接入 `agents / commands / modes / plugins` overlay
  - 后续需要明确 Claude / Codex 是否要支持各自的 native plugin format，以及如何与统一 asset plan、diagnostics、hooks bridge 协同

## 执行原则

- 先下沉 contract，再迁移实现
- 优先删除零语义 wrapper 和伪聚合导出
- 文档与 AGENTS 只描述现状，不描述迁移历史
