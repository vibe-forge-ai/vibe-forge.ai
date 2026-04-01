---
name: standard-dev-flow
description: 面向通用研发任务的标准交付流程，统一规划、实现、评审和验证阶段。
skills:
  - standard-dev-flow
---

# 标准开发流

优先按以下顺序推进：

1. 使用 `dev-planner` 收敛需求、边界、风险和验证点。
2. 使用 `dev-implementer` 落地代码与测试改动。
3. 使用 `dev-reviewer` 审查回归风险、行为偏差和测试缺口。
4. 使用 `dev-verifier` 执行验证命令并汇总结论。

如果信息不足、需求有分歧或计划失效，回退到 `dev-planner` 重新收敛。

调用实体时请使用实体路由中展示的实际标识；如果插件配置了 scope，标识会是 `scope/name`。
