# @vibe-forge/workspace-assets 0.11.2

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/workspace-assets@0.11.2`

## 主要变更

- workspace asset bundle 现在会从可配置的 AI 基目录扫描 `rules`、`skills`、`specs`、`mcp` 等资产。
- `entities` 的扫描目录也支持通过 `__VF_PROJECT_AI_ENTITIES_DIR__` 单独覆盖，不再固定要求使用 `.ai/entities`。
- 这次调整会被 definition loader、prompt 组装和上层 workspace bundle 消费链路一起继承。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改变默认的扫描规则。
- 未配置环境变量时，现有 `.ai/*` 目录结构继续正常工作。
