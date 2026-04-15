# @vibe-forge/adapter-claude-code 0.11.2

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/adapter-claude-code@0.11.2`

## 主要变更

- Claude Code adapter 的 mock HOME、plugin staging、CCR daemon 与 log-context 派生目录现在都会跟随项目配置的 AI 基目录。
- 这次调整让 Claude 运行时在 `.vf` 或更深嵌套目录结构下也能正确消费本地技能、插件和日志上下文。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增 adapter 配置字段。
- 未配置自定义目录时，现有 `.ai` 路径继续按原样工作。
