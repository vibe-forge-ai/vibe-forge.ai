# 0.8.4

发布日期：2026-04-03

## 发布范围

- 发布 `@vibe-forge/types@0.8.4`
- 发布 `@vibe-forge/utils@0.8.4`
- 发布 `@vibe-forge/config@0.8.4`
- 发布 `@vibe-forge/definition-loader@0.8.4`
- 发布 `@vibe-forge/workspace-assets@0.8.4`
- 发布 `@vibe-forge/hooks@0.8.4`
- 发布 `@vibe-forge/task@0.8.4`
- 发布 `@vibe-forge/mcp@0.8.4`
- 发布 `@vibe-forge/adapter-claude-code@0.8.4`
- 发布 `@vibe-forge/adapter-codex@0.8.4`
- 发布 `@vibe-forge/adapter-opencode@0.8.4`
- 发布 `@vibe-forge/cli@0.8.4`
- 发布 `@vibe-forge/client@0.8.4`
- 发布 `@vibe-forge/server@0.8.4`

## 主要变更

- 改进 plugin / rule / skill / spec 的装载链路，补齐 npm plugin 资产解析、prompt 构建边界、workspace assets 选择与 definition loader 的职责拆分。
- 完善 hooks、task、CLI 和多 adapter 的会话控制能力，覆盖 resume/list/stop 行为、CLI `--print` 成功退出路径，以及 Codex、OpenCode、Claude Code 的运行时细节修复。
- 强化 Claude Code CCR 日志诊断，补齐按 session 归属的上下文日志、流式响应组装和 TypeScript 版 transformer 维护路径。
- 打通 Lark channel 下的 `AskUserQuestion` 交互闭环，修复 server 的 interaction 投递与回填、Claude Code headless 权限透传，以及 MCP 工具对交互结果的解包。
- 更新 Client 与 Server 的运行时配置和会话展示，补齐 basename 回退、配置表单、channel 偏好与 session 数据读取等细节修复。

## 兼容性说明

- 本次为增量发布，不引入新的破坏性输入格式；既有 `model`、`permissionMode`、channel 绑定和插件配置仍保持兼容。
- `definition-loader`、`workspace-assets`、`hooks`、`mcp` 这批仍停留在 `0.8.0` 的 support 包，本次统一提升到 `0.8.4`，方便与当前 CLI / Server / adapter 能力对齐。
- `@vibe-forge/channel-lark` 与 `@vibe-forge/plugin-standard-dev` 未纳入本次发布；前者本轮仅有调试文档整理，后者保留独立版本线。
