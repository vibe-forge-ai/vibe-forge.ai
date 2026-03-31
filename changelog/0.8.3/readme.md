# 0.8.3

发布日期：2026-03-31

## 发布范围

- 发布 `@vibe-forge/types@0.8.3`
- 发布 `@vibe-forge/utils@0.8.3`
- 发布 `@vibe-forge/config@0.8.3`
- 发布 `@vibe-forge/core@0.8.3`
- 发布 `@vibe-forge/task@0.8.3`
- 发布 `@vibe-forge/benchmark@0.8.3`
- 发布 `@vibe-forge/adapter-claude-code@0.8.3`
- 发布 `@vibe-forge/adapter-codex@0.8.3`
- 发布 `@vibe-forge/adapter-opencode@0.8.3`
- 发布 `@vibe-forge/cli@0.8.3`
- 发布 `@vibe-forge/client@0.8.3`
- 发布 `@vibe-forge/server@0.8.3`

## 主要变更

- 为 `claude-code`、`codex`、`opencode` 三个内置 adapter 增加统一的 `effort` 能力，覆盖配置默认值、CLI、Web 会话、Channel 会话和 benchmark 入口。
- 新增顶层 `effort` 与 `models.<model>.effort` 配置，生效顺序为显式运行态输入、模型元数据、adapter 默认值、全局默认值。
- Chat UI、Server session 管理和 channel 指令现在都支持显式查看和切换会话 `effort`。
- Codex 本地 proxy 日志增强为完整请求诊断，额外记录代理前后的请求体、路由上下文、响应摘要和非流式错误响应内容。

## 兼容性说明

- 本次变更为增量能力，未修改既有 `model`、`adapter`、`permissionMode` 的输入格式。
- 未显式设置 `effort` 时，运行时行为保持与历史默认值兼容。
- Codex proxy 新日志会继续对敏感头和密钥类字段做脱敏，但日志体量会明显增加。
