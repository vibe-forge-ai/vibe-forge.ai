# @vibe-forge/adapter-codex 0.9.2

发布日期：2026-04-07

## 发布范围

- 发布 `@vibe-forge/adapter-codex@0.9.2`

## 主要变更

- Codex adapter 在选择 MCP servers 时，显式 `include` 现在会覆盖 `defaultExcludeMcpServers`。
- 这让消费方可以通过运行时 `--include-mcp-server` 临时启用默认排除的 MCP server。

## 兼容性说明

- 默认 include/exclude 配置保持不变。
- 只有显式 include 同名 MCP server 时，默认 exclude 才不会继续遮蔽它。
