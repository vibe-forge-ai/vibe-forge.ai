---
alwaysApply: false
description: 当任务涉及 hooks 方案、托管配置、事件矩阵或启用与排查时加载的 hooks 入口说明。
---

# 通用 Hooks 方案

本文件是 hooks 方案入口页；统一语义和实现细节拆到 `hooks/`，更深的维护细节继续看 [HOOKS-REFERENCE.md](./HOOKS-REFERENCE.md)。

## 先看这些

- [托管配置](./hooks/managed-files.md)
- [事件矩阵](./hooks/events.md)
- [启用与排查](./hooks/operations.md)

## 核心设计

1. 初始化 adapter 时，在工作区 `.ai/.mock` 下生成托管配置。
2. 各家 agent 的原生 hooks / plugin 机制都回调到同一个 Vibe Forge hook runtime。
3. `TaskStart` / `TaskStop` / `SessionEnd` 这类框架事件仍由 Vibe Forge 自己触发。

## 结果

- `claude-code`、`codex`、`opencode` 共用同一套 `plugins.<name>` hook 插件实现。
- 用户真实 home 不会被自动改写。
- 新接 agent 时，只需要补 mock 配置和事件映射，不需要重做一遍 hook 体系。
