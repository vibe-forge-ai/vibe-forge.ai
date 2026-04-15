# @vibe-forge/cli 0.11.3

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/cli@0.11.3`

## 主要变更

- `vf clear`、`vf report` 和 session cache 目录现在都会跟随 `__VF_PROJECT_AI_BASE_DIR__` 解析，不再固定清理或打包 `./.ai/`。
- 当项目把 AI 数据目录迁到 `.vf` 或其他嵌套目录时，CLI 的运维命令会自动落到新的目录结构。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增命令参数。
- 未配置自定义目录时，CLI 仍然默认处理 `.ai` 下的日志和缓存。
