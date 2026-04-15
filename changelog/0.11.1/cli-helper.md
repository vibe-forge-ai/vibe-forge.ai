# @vibe-forge/cli-helper 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/cli-helper@0.11.1`

## 主要变更

- CLI helper 入口现在会优先读取 `__VF_PROJECT_AI_BASE_DIR__`，不再把隔离运行目录写死到项目内的 `./.ai/.mock`。
- 当项目把 AI 数据资产目录改到 `.vf` 或更深的嵌套路径时，helper 启动出来的 mock HOME 会自动跟随新的基目录。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增 CLI 参数。
- 未配置 `__VF_PROJECT_AI_BASE_DIR__` 时，行为继续保持为默认的 `.ai` 目录。
