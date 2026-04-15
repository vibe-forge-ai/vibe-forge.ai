# @vibe-forge/utils 0.11.2

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/utils@0.11.2`

## 主要变更

- 新增统一的 AI 目录解析 helper，支持通过 `__VF_PROJECT_AI_BASE_DIR__` 覆盖项目数据资产根目录。
- 新增 `__VF_PROJECT_AI_ENTITIES_DIR__` 支持，只覆盖 `entities` 子目录，且允许继续使用嵌套路径。
- cache、logger、managed plugin 与权限相关运行时路径现在都改为复用这一组统一 helper。

## 兼容性说明

- 本次为向后兼容的 patch 发布，只新增能力，不移除现有导出。
- 未配置环境变量时，默认目录仍然解析到 `.ai` 和 `.ai/entities`。
