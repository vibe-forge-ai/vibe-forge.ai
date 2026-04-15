# @vibe-forge/adapter-opencode 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/adapter-opencode@0.11.1`

## 主要变更

- OpenCode adapter 生成 session 子进程环境和 skill 配置时，现在会跟随项目配置的 AI 基目录解析本地资产路径。
- 当项目把 `.ai` 改名或移动到嵌套目录时，OpenCode 运行时不再继续引用旧的固定路径。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增 adapter 配置项。
- 未配置自定义目录时，现有 `.ai` 结构继续可用。
