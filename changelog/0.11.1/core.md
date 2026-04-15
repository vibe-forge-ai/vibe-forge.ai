# @vibe-forge/core 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/core@0.11.1`

## 主要变更

- `AskUserQuestionParamsSchema` 的权限交互上下文新增 `subjectLookupKeys`，允许 adapter 显式传入一组等价权限 key，供上层在恢复 session/project 权限时统一判定。

## 兼容性说明

- 本次为向后兼容的 patch 发布，新增字段为可选项。
- 旧的权限交互 payload 不需要修改，未传 `subjectLookupKeys` 时会继续按原有 `subjectKey` 工作。
