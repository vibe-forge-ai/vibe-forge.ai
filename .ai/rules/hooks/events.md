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

## Codex 特别说明

- Codex 官方原生 `PreToolUse` / `PostToolUse` 当前只稳定覆盖 `Bash`。
- `apply_patch`、`web_search`、MCP、文件变更这类非 Bash 工具，如果要补齐统计，优先走 transcript JSONL 旁路观测。
- JSONL 旁路只能补“看见了什么工具、何时发生、输入摘要是什么”这类统计事实，不能像原生 hook 那样通过返回值阻断、改写或继续当前会话。
- 因此 Codex 的非 Bash JSONL 观测事件统一按 `canBlock: false` 处理，即使它们最终映射成统一 hook 日志，也不能冒充 native `PreToolUse` / `PostToolUse`。

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
