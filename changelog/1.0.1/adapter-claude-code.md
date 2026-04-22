# @vibe-forge/adapter-claude-code 1.0.1

发布日期：2026-04-17

## 发布范围

- 发布 `@vibe-forge/adapter-claude-code@1.0.1`

## 主要变更

- Claude Code adapter 初始化共享 mock home 时，`skills` 与 `Library/Keychains` 的软链接同步改为并发安全。
- 多个 `vf` 进程同时准备同一套 Claude mock 资产时，不再因为目录或链接已被其他进程先创建而直接失败。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改 adapter 入口与协议表面。
