# @vibe-forge/server 0.11.1

发布日期：2026-04-13

## 发布范围

- 发布 `@vibe-forge/server@0.11.1`

## 主要变更

- 新增 Lark 会话管理指令：`/session search`、`/session bind`、`/session unbind`，支持在当前窗口搜索、绑定和解除系统内已有会话，便于接力开发和上下文调整。
- Channel 与系统会话的绑定关系现在支持跨窗口转移，并会在服务重启后从数据库自动恢复，避免重启后绑定关系丢失。
- 会话启动日志补充 `requestedModel`、`persistedModel`、`resolvedModel` 等模型解析信息，便于排查 resume 过程中 provider 漂移和 channel 初始化问题。
- Codex adapter 上报裸模型名时，不再覆盖服务端已解析出的完整模型选择器，避免 resume 后把 `gpt-responses,...` 错写成不带 provider 的模型串。

## 兼容性说明

- 本次为向后兼容的 patch 发布，现有 channel 与 session 数据结构可直接复用。
- 新增 `/session` 指令仅对管理员开放，不改变普通消息流转行为。
