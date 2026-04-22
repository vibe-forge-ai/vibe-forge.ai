---
name: standard-dev-flow
description: 调度规划、实现、评审和验证实体的标准研发工作流。
---

# 标准开发流

这个 skill 用于把通用开发任务拆成稳定的交付阶段，并通过 `StartTasks` 协调不同实体。

## 默认阶段

1. 规划：使用 `dev-planner` 收敛目标、边界、风险和验证点。
2. 实现：使用 `dev-implementer` 完成代码与测试改动。
3. 评审：使用 `dev-reviewer` 检查回归风险、行为变化和测试缺口。
4. 验证：使用 `dev-verifier` 执行相关命令并整理证据。

## 调度原则

- 先规划，再进入实现，不要跳过 `dev-planner`。
- 实现完成后再进行评审和验证，这两个步骤可以并行。
- 如果目标不清、上下文缺失或计划失效，回退到规划阶段。
- 每个子任务都要求输出结论、证据、风险和建议下一步。

## 工具使用

- 用 `StartTasks` 启动实体任务。
- 用 `GetTaskInfo` 跟踪后台任务状态。
- 用 `SendTaskMessage` 给同一条任务补充指令：`direct` 立即续跑，`steer` 排队等当前 run 自然结束后继续。
- 必要时用 `StopTask` 停止明显跑偏的任务。

## 命名约定

- 如果插件配置了 scope，请使用实体路由里展示的实际标识，例如 `scope/dev-planner`。
- 如果没有配置 scope，直接使用 `dev-planner`、`dev-implementer`、`dev-reviewer`、`dev-verifier`。

## 推荐任务模板

### 规划任务

- `type: "entity"`
- `name: "dev-planner"` 或 scoped 标识
- 描述中写清楚目标、约束、已有上下文和交付预期

### 实现任务

- `type: "entity"`
- `name: "dev-implementer"` 或 scoped 标识
- 描述中附上规划结论、影响范围、需要补的测试或验证

### 评审任务

- `type: "entity"`
- `name: "dev-reviewer"` 或 scoped 标识
- 描述中要求按问题严重度输出主要发现

### 验证任务

- `type: "entity"`
- `name: "dev-verifier"` 或 scoped 标识
- 描述中列出建议执行的命令、预期结果和阻塞处理方式
