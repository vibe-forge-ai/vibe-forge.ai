# @vibe-forge/adapter-claude-code 0.10.3

发布日期：2026-04-10

## 发布范围

- 发布 `@vibe-forge/adapter-claude-code@0.10.3`

## 主要变更

- Claude Code Router 默认注册的内置 transformer 里补上 `kimi-thinking-polyfill`
- 当项目在 `claudeCodeRouterTransformer` 里为 `kimi-k2.5` 等模型声明 `use: ['kimi-thinking-polyfill']` 时，生成出来的 `.claude-code-router/config.json` 现在会包含对应 transformer 文件
- 避免 provider 上已经引用 Kimi transformer，但顶层 `transformers` 缺失，导致运行时实际无法加载的问题

## 兼容性说明

- 不新增配置项
- 只修正 `@vibe-forge/adapter-claude-code` 的 CCR 默认配置生成逻辑
