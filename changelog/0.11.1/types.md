# @vibe-forge/types 0.11.1

发布日期：2026-04-14

## 发布范围

- 发布 `@vibe-forge/types@0.11.1`

## 主要变更

- 新增共享 Git 类型定义，覆盖仓库状态、分支列表、worktree 列表、提交摘要，以及 commit / push 的请求载荷。
- `index.ts` 补齐 Git 类型导出，client、server 和 adapter 可以直接复用同一份契约，减少重复声明与字段漂移。

## 兼容性说明

- 本次为向后兼容的 patch 发布，仅新增导出，不移除现有类型。
