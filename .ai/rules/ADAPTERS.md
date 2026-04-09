---
alwaysApply: false
description: 当任务涉及 adapter runtime、mock home、原生资产自动适配、MCP 自动生效或真实 adapter CLI 验证时加载。
---

# Adapter 设计

本文件是 adapter 设计入口页；统一设计、资产适配、运行时配置和真实验证拆到 `adapter-design/`。

## 先看这些

- [设计总览](./adapter-design/overview.md)
- [原生资产适配](./adapter-design/native-assets.md)
- [运行时配置](./adapter-design/runtime-config.md)
- [真实 CLI 验证](./adapter-design/verification.md)

## 核心结论

1. workspace 里的共享配置和资产先收敛成统一 `Config + WorkspaceAssetBundle`，再由 adapter 映射成原生运行时。
2. home 级原生配置统一落到 `.ai/.mock` 或 session config dir，不自动改写用户真实 home。
3. 有稳定原生落点的资产走 native / translated；没有稳定原生语义的资产继续走 prompt 或跳过。

## 和其他文档的关系

- hooks 事件矩阵、托管 hooks 文件与排查仍看 [HOOKS.md](./HOOKS.md) 和 [HOOKS-REFERENCE.md](./HOOKS-REFERENCE.md)
- 仓库整体运行链路看 [ARCHITECTURE.md](./ARCHITECTURE.md)
