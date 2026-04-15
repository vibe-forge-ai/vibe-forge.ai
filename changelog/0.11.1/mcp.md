# @vibe-forge/mcp 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/mcp@0.11.1`

## 主要变更

- `StartTasks` 现在会在任务未显式设置 `permissionMode` 时继承父会话权限模式，并把解析后的 `taskId`、`permissionMode` 一并传给 `StartTasks` hook 和 child session。
- task runtime tools 补齐了阻塞恢复链路：`GetTaskInfo` / `ListTasks` 会返回 `pendingInput`、`lastError` 和下一步 guidance，新增 `SubmitTaskInput` 统一提交权限或普通输入，不再只能靠看日志猜问题。
- `run tasks` 的日志和状态不再静默丢失交互事件。权限请求、`permission_required` 细节、server sync poll 失败，以及停止 blocked task 后同步回 child session 的终态，现在都会被明确记录。
- `StopTask` 现在可以清掉已经进入 `waiting_input`、但底层进程已退出的 blocked task；对开启 server sync 的任务，还会把取消/失败事件同步回 child session，避免 server/UI 继续卡在等待输入。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不移除原有 task 工具。
- `RespondTaskInteraction` 仍可继续使用，但推荐迁移到更通用的 `SubmitTaskInput`。
