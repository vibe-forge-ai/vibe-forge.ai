# @vibe-forge/server 0.11.3

发布日期：2026-04-14

## 发布范围

- 发布 `@vibe-forge/server@0.11.3`

## 主要变更

- 新增会话级 Git API，支持读取仓库状态、列出分支和 worktree，以及执行 checkout、create branch、commit、push、sync。
- Git 服务补齐 staged / working tree 摘要、HEAD commit、upstream / ahead-behind 统计和 worktree 解析，前端现在可以直接展示更完整的仓库上下文。
- 分支切换会阻止切到已被其他 worktree 占用的本地分支，并对 commit / push 请求参数做显式校验，减少误操作和模糊错误。

## 兼容性说明

- 本次为向后兼容的 patch 发布，新增的 Git 路由只在会话工作区位于 Git 仓库内时生效。
- 现有 session、channel 和非 Git 工作区流程不受影响。
