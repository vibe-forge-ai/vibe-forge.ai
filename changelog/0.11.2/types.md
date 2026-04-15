# @vibe-forge/types 0.11.2

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/types@0.11.2`

## 主要变更

- `PermissionInteractionContext` 新增可选字段 `subjectLookupKeys`，用于表达同一权限目标对应的多组 lookup key，方便 server / adapter 在历史审批 key、标准名和工具级 key 之间做统一匹配。

## 兼容性说明

- 本次为向后兼容的 patch 发布，新增字段为可选项。
- 依赖方可以按需读取该字段；不消费它的现有实现不会受到影响。
