# @vibe-forge/types 3.0.0-alpha.8

发布日期：2026-04-24

## 发布范围

- 发布 `@vibe-forge/types@3.0.0-alpha.8`

## 主要变更

- Adapter loader 支持从调用方 package dir 和运行时 package dir 解析 adapter，避免 bootstrap CLI 自身未安装 adapter 时 `StartTasks` 无法启动子任务。
