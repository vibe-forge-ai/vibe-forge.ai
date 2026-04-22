# @vibe-forge/adapter-kimi 1.0.1

发布日期：2026-04-17

## 发布范围

- 发布 `@vibe-forge/adapter-kimi@1.0.1`

## 主要变更

- Kimi adapter 在同步运行时配置与工作区覆盖目录时，软链接创建改为并发安全。
- 并发准备同一套 Kimi 运行时目录时，已存在且目标正确的链接会被直接复用，不再因为 `EEXIST` 中断初始化。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改 adapter 入口与协议表面。
