# Hooks 事件矩阵

返回入口：[HOOKS.md](../HOOKS.md)

## 支持矩阵

| Hook 事件                                      | Claude Code | Codex    | OpenCode |
| ---------------------------------------------- | ----------- | -------- | -------- |
| `TaskStart` / `TaskStop`                       | 框架触发    | 框架触发 | 框架触发 |
| `SessionStart`                                 | native      | native   | native   |
| `UserPromptSubmit`                             | native      | native   | bridge   |
| `PreToolUse`                                   | native      | native   | native   |
| `PostToolUse`                                  | native      | native   | native   |
| `Stop`                                         | native      | native   | native   |
| `SessionEnd`                                   | bridge      | bridge   | bridge   |
| `Notification` / `SubagentStop` / `PreCompact` | native      | 不支持   | 不支持   |

## 统一输入语义

- `adapter`：`claude-code` / `codex` / `opencode`
- `runtime`：`cli` / `server` / `mcp`
- `hookSource`：`native` 或 `bridge`
- `canBlock`：当前事件是否还能真正阻止动作继续

`canBlock: true` 的典型事件：

- `TaskStart`
- `SessionStart`
- `UserPromptSubmit`
- native `PreToolUse`
- native `PostToolUse`
- `PreCompact`

其余 bridge 观测事件、`Stop`、`SessionEnd`、`Notification`、`SubagentStop` 统一视为 `canBlock: false`。
