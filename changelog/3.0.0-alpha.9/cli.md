# @vibe-forge/cli 3.0.0-alpha.9

发布日期：2026-04-24

## 发布范围

- 发布 `@vibe-forge/cli@3.0.0-alpha.9`

## 主要变更

- CLI 内置一方 adapter 运行时依赖，修复 bootstrap 环境下 `VibeForge.StartTasks` 启动 Codex 子任务时找不到 `@vibe-forge/adapter-codex` 的问题。

## 后续修正

- 该处理方向已在 `3.0.0-alpha.10` 撤销；CLI 不应内置一方 adapter，adapter 应从项目或调用方依赖中解析。
