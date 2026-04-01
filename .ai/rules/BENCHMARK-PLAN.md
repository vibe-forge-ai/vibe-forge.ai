---
alwaysApply: false
description: 当任务涉及 benchmark 落地拆分、阶段目标、开发顺序与里程碑时加载的规划文档。
---

# Benchmark 实施规划

本文件是 benchmark 落地规划入口页，只保留阶段总览；细节拆到 `benchmark-plan/`。

## 先看这些

- [模块拆分](./benchmark-plan/modules.md)：中间层、后端、CLI、前端分别做什么。
- [阶段目标](./benchmark-plan/phases.md)：MVP 到页面化的分阶段验收标准。
- [开发顺序](./benchmark-plan/roadmap.md)：推荐推进顺序、里程碑和风险。

## 总体原则

- benchmark 核心能力统一下沉到 `packages/benchmark`。
- CLI 和后端通过 `@vibe-forge/app-runtime` 复用 runtime。
- 前端共享 contract，只通过后端接口读写和发起运行。
- 先建立可复用的 benchmark 骨架，再逐步补交互和可视化。
