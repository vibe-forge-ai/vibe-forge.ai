# @vibe-forge/adapter-codex 0.11.3

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/adapter-codex@0.11.3`

## 主要变更

- 内建 MCP server 对外标准名统一为 `VibeForge`，但 Codex 权限审批内部继续保留稳定的 built-in MCP slug，避免已有 `mcp-vibe-forge-*` 历史授权在升级后失效。
- Codex 权限交互事件现在会显式携带 `subjectLookupKeys`，把工具级审批 key、历史 slug 和内建 MCP 标准名一起传给 server，方便 server 统一做权限恢复和 project/session 命中。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改变 adapter 入口、runtime 选择或 CLI 参数。
- 现有 Codex 会话和历史审批记录无需迁移；升级后会继续识别旧 slug。
