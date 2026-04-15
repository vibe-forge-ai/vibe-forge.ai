# @vibe-forge/adapter-codex 0.11.1

发布日期：2026-04-14

## 发布范围

- 发布 `@vibe-forge/adapter-codex@0.11.1`

## 主要变更

- 兼容新版 Codex approval payload：命令展示不再假定 `payload.command` 一定是数组，避免 `join is not a function` 直接打断审批链路。
- 补齐 `mcpServer/elicitation/request` 处理，Codex 调用 MCP 工具前的权限确认现在会正确返回，不再因为内部请求悬空导致会话一直停在 thinking。
- MCP 审批作用域收窄到具体 tool，拒绝动作统一回协议要求的 `decline` / `cancel`，避免把只读确认误扩成整个 server 的持久化放行。

## 兼容性说明

- 不改公开包名与主要入口。
- 属于 Codex adapter 的兼容性修复，已有 Claude / OpenCode adapter 不受影响。
- 建议消费方升级后至少回归一次 MCP 工具调用和命令审批链路。
