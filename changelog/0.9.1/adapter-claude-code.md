# @vibe-forge/adapter-claude-code 0.9.1

发布日期：2026-04-05

## 发布范围

- 发布 `@vibe-forge/adapter-claude-code@0.9.1`

## 主要变更

- Claude Code native hook bridge 现在显式声明自己支持的 hook event 范围。
- 不在支持范围内的 event 会回退到 managed hooks 处理，避免被 native bridge 错误拦截。

## 兼容性说明

- 已有的 Claude 原生 hook 事件映射保持不变。
- 这次调整只影响 bridge 选择逻辑，不增加新的用户输入参数。
