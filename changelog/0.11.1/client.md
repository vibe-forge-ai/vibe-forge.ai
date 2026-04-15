# @vibe-forge/client 0.11.1

发布日期：2026-04-14

## 发布范围

- 发布 `@vibe-forge/client@0.11.1`

## 主要变更

- 聊天页 header 新增 Git 控制区，支持查看仓库状态、切换/新建分支、同步远端，以及在会话内发起 commit / push。
- Git 提交流程补齐 staged / working tree 摘要、amend、skip hooks、force push 和 worktree 感知，减少在多 worktree 场景下误切分支的风险。
- 工具调用渲染继续整理，通用工具、Claude 工具和 Chrome DevTools 工具的字段展示与摘要结构更一致。
- 会话切换时恢复消息历史与缓存的行为修正，避免来回切换后聊天记录短暂丢失或闪回旧状态。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改客户端入口命令。
- Git 控制区依赖服务端提供对应 Git API；若要启用完整能力，建议与 `@vibe-forge/server@0.11.3` 和 `@vibe-forge/types@0.11.1` 配套升级。
