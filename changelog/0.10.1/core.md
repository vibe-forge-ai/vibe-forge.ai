# @vibe-forge/core 0.10.1

发布日期：2026-04-12

## 发布范围

- 发布 `@vibe-forge/core@0.10.1`

## 主要变更

- 正式发布包补齐 channel MCP 解析辅助 API，和当前源码里的 `@vibe-forge/core/channel` 导出保持一致。
- `@vibe-forge/channel-lark` 在解析 session MCP server 时依赖的 `defineResolveChannelSessionMcpServers` 现在会随正式版一起提供。
- 这次发布用于补齐 `0.10.x` 依赖闭包里的 runtime 兼容性，不改变 channel 配置协议。

## 兼容性说明

- 不新增配置项。
- 现有 `@vibe-forge/core/channel` 消费方式继续兼容，这次只补齐正式发布包的导出能力。
