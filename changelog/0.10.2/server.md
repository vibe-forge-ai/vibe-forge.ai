# @vibe-forge/server 0.10.2

发布日期：2026-04-12

## 发布范围

- 发布 `@vibe-forge/server@0.10.2`

## 主要变更

- 正式版 `@vibe-forge/server` 随同消费 `@vibe-forge/register@0.10.2`
- 确保 `ai app` 在消费者环境里也能拿到新的 runtime transpile 元数据策略
- 不改 server 走源码启动的设计，只修正最终发布依赖组合

## 兼容性说明

- 对外启动方式不变
- 这次发布主要把 `register` 的 runtime 修复稳定透传到消费仓
