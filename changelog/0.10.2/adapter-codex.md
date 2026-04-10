# @vibe-forge/adapter-codex 0.10.2

发布日期：2026-04-10

## 发布范围

- 发布 `@vibe-forge/adapter-codex@0.10.2`

## 主要变更

- command 模式启动的 Codex MCP server 会继续透传必要的 vibe-forge 会话环境变量到子进程。
- 这次修复让 Codex 子进程里的 managed runtime、hooks 和插件解析都能拿到完整上下文，不再因为环境缺失导致插件包解析失败或工具链路异常中断。

## 兼容性说明

- 不改 Codex adapter 协议。
- 仅补齐子进程环境透传，已有会话和 MCP 工具调用方式继续兼容。
