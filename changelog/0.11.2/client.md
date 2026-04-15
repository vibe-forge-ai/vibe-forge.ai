# @vibe-forge/client 0.11.2

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/client@0.11.2`

## 主要变更

- client 启动入口现在会跟随 `__VF_PROJECT_AI_BASE_DIR__` 推导默认的 mock HOME，而不是写死到 `./.ai/.mock`。
- 知识库里与实体相关的空态和引导文案不再硬编码 `.ai/entities`，避免项目改目录后 UI 提示误导用户。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增前端配置项。
- 未配置自定义目录时，默认行为继续保持不变。
