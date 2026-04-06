# @vibe-forge/workspace-assets 0.9.2

发布日期：2026-04-07

## 发布范围

- 发布 `@vibe-forge/workspace-assets@0.9.2`

## 主要变更

- MCP server 选择逻辑里，显式 `include` 现在会覆盖 `defaultExcludeMcpServers`。
- 这让消费方通过运行时参数临时启用默认排除的 MCP server 成为一致行为。

## 兼容性说明

- 默认 include/exclude 语义不变。
- 只有显式传入 `include` 时，默认 exclude 才不会继续遮蔽同名 MCP server。
