# @vibe-forge/adapter-gemini 1.0.1

发布日期：2026-04-17

## 发布范围

- 发布 `@vibe-forge/adapter-gemini@1.0.1`

## 主要变更

- Gemini adapter 初始化共享 mock home 时，`skills` 与运行时配置的软链接同步改为并发安全。
- 多个 `vf` 进程同时启动并指向同一 Gemini mock 目录时，不再因为已有正确链接而报 `EEXIST`。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改 adapter 入口与协议表面。
