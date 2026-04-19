# @vibe-forge/adapter-copilot 1.0.1

发布日期：2026-04-17

## 发布范围

- 发布 `@vibe-forge/adapter-copilot@1.0.1`

## 主要变更

- Copilot adapter 在同步共享 mock home 配置与 `Library/Keychains` 时，软链接创建改为并发安全。
- 多个 `vf` 进程同时初始化同一套 Copilot mock 目录时，不再因为目标已存在而报 `EEXIST`。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改 adapter 入口与协议表面。
