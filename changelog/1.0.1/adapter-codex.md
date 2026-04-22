# @vibe-forge/adapter-codex 1.0.1

发布日期：2026-04-17

## 发布范围

- 发布 `@vibe-forge/adapter-codex@1.0.1`

## 主要变更

- Codex adapter 初始化 `.ai/.mock` 目录时，`skills` 与认证文件的软链接同步改为并发安全。
- 多个 `vf` 进程同时启动并共享同一 mock home 时，不再因为已有进程先创建好目标链接而报 `EEXIST` 退出。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改 adapter 入口与协议表面。
