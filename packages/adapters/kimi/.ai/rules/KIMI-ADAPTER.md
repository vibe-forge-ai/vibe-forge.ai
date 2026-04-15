---
alwaysApply: false
description: 当任务涉及 Kimi adapter runtime、Kimi CLI 安装、modelServices 转换、native hooks、client 图标或真实 Kimi CLI 验证时加载。
---

# Kimi Adapter

本文件是 Kimi adapter 维护入口页；运行时、模型服务、hooks/assets 和验证细节拆到同目录下的细分文件。

## 先读这些

- [运行时与安装](./runtime.md)
- [modelServices 转换](./model-services.md)
- [hooks 与 assets](./hooks-and-assets.md)
- [验证与官方资料](./verification.md)

## 关联规则

- 根规则：[.ai/rules/ADAPTERS.md](../../../../../.ai/rules/ADAPTERS.md)
- 根规则：[.ai/rules/HOOKS.md](../../../../../.ai/rules/HOOKS.md)
- 根规则：[.ai/rules/HOOKS-REFERENCE.md](../../../../../.ai/rules/HOOKS-REFERENCE.md)
- [packages/workspace-assets/AGENTS.md](../../../../../packages/workspace-assets/AGENTS.md)
- [packages/task/AGENTS.md](../../../../../packages/task/AGENTS.md)
- [apps/cli/src/AGENTS.md](../../../../../apps/cli/src/AGENTS.md)

## 核心边界

1. Kimi `--print` 会隐式启用 yolo，权限安全必须依赖 native hooks。
2. adapter 自动安装只用 `uv tool install` 写入 `.ai/caches/adapter-kimi/cli`，不在 init 中执行官方 `install.sh`。
3. `showThinkingStream` 已在配置类型中声明，但 runtime 尚未映射到 Kimi config 的 `show_thinking_stream`。
4. client 展示图标必须来自官方 KIMI Brand Guidelines。

## 相关记录

- [PR #102](https://github.com/vibe-forge-ai/vibe-forge.ai/pull/102) 是 Kimi adapter 的实现与评审记录。
