# @vibe-forge/hooks 0.11.2

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/hooks@0.11.2`

## 主要变更

- `vf-call-hook` 和 hooks native runtime 现在会通过统一目录 helper 解析 mock HOME 与项目资产路径。
- 当项目把 AI 资产目录改到非默认位置时，hooks 运行时不再继续假定目录必须是 `./.ai/`。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增 hook 事件或配置字段。
- 默认目录结构保持不变，仅在显式配置环境变量时启用新路径。
