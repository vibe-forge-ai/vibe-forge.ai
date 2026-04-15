# @vibe-forge/server 0.11.4

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/server@0.11.4`

## 主要变更

- 权限解析链路现在支持基于 `subjectLookupKeys` 统一聚合同一审批目标的多组 key，并按 deny / ask / allow 的正常优先级做一次性判定，不再因为历史 slug 和新 slug 混用而出现旧 allow 覆盖新 deny 的问题。
- Codex 内建 MCP 的默认 `VibeForge` 权限现在可以正确兜住工具级审批恢复；server 不再依赖字符串前缀猜测 built-in MCP，而是使用 adapter 显式传入的 lookup key 集合做匹配。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改变现有 HTTP / WebSocket 路由。
- 旧的权限镜像和会话状态仍可继续使用；新的 lookup key 聚合只会在 adapter 提供额外 key 时生效。
