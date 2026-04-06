# @vibe-forge/mcp 0.9.2

发布日期：2026-04-07

## 发布范围

- 发布 `@vibe-forge/mcp@0.9.2`

## 主要变更

- MCP 包级 CLI 现在直接在根命令上启动 stdio server，不再要求额外的 `mcp` 子命令。
- 默认注入配置和手动直接执行 `vf-mcp` / `vibe-forge-mcp` 的行为保持一致。

## 兼容性说明

- `cli.js` root 入口现在就是标准启动方式。
- 外部如果仍显式传 `mcp` 子命令，需要同步切回 root 调用方式。
