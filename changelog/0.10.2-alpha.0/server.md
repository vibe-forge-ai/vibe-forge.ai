# @vibe-forge/server 0.10.2-alpha.0

发布日期：2026-04-12

## 发布范围

- 发布 `@vibe-forge/server@0.10.2-alpha.0`

## 主要变更

- 让 `@vibe-forge/server` 的 alpha 版本随同消费 `@vibe-forge/register@0.10.2-alpha.0`
- 确保 `node_modules` 内跑源码的 server CLI 在消费者环境里也能拿到新的 runtime transpile 元数据策略
- 避免消费仓仅升级 CLI 时，`ai app` 仍回退命中旧版 `register`

## 兼容性说明

- 不改 server 的源码启动设计
- 这次 alpha 只调整发布版本与上游运行时依赖组合，用于把 `register` 修复真实传递到消费者
