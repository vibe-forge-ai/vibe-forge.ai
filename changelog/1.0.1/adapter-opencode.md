# @vibe-forge/adapter-opencode 1.0.1

发布日期：2026-04-17

## 发布范围

- 发布 `@vibe-forge/adapter-opencode@1.0.1`

## 主要变更

- OpenCode adapter 在初始化 mock home、同步 native hooks 配置与 session skill overlay 时，软链接同步改为并发安全。
- 多个 `vf` 进程同时准备同一套 OpenCode 运行时目录时，不再因为目标已被其他进程创建而直接失败。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改 adapter 入口与协议表面。
