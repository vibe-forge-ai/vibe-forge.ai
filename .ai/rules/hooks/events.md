# Hooks 事件矩阵

返回入口：[HOOKS.md](../HOOKS.md)

## 支持矩阵

| Hook 事件                | Claude Code | Codex    | Gemini                  | Kimi     | OpenCode |
| ------------------------ | ----------- | -------- | ----------------------- | -------- | -------- |
| `TaskStart` / `TaskStop` | 框架触发    | 框架触发 | 框架触发                | 框架触发 | 框架触发 |
| `SessionStart`           | native      | native   | native                  | native   | native   |
| `UserPromptSubmit`       | native      | native   | native                  | native   | bridge   |
| `PreToolUse`             | native      | native   | native                  | native   | native   |
| `PostToolUse`            | native      | native   | native                  | native   | native   |
| `Stop`                   | native      | native   | native                  | native   | native   |
| `SessionEnd`             | bridge      | bridge   | bridge                  | bridge   | bridge   |
| `Notification`           | native      | 不支持   | 不支持                  | 不支持   | 不支持   |
| `SubagentStop`           | native      | 不支持   | 不支持                  | 不支持   | 不支持   |
| `PreCompact`             | native      | 不支持   | native (`PreCompress`)  | 不支持   | 不支持   |

- Gemini 原生 `PreCompress` 已映射到统一 `PreCompact`。
- `codex` / `kimi` / `opencode` 的 `PreCompact` 缺口跟踪见 [Issue #109](https://github.com/vibe-forge-ai/vibe-forge.ai/issues/109)。

## Codex 特别说明

- Codex 官方原生 `PreToolUse` / `PostToolUse` 当前只稳定覆盖 `Bash`。
- 当前仓库里，Codex transcript JSONL bridge 已验证覆盖 `apply_patch`、`web_search`、MCP、`file_change` 这几类非 Bash 事件。
- 这几类非 Bash 工具如果要补齐统计，优先走 transcript JSONL 旁路观测。
- JSONL 旁路只能补“看见了什么工具、何时发生、输入摘要是什么”这类统计事实，不能像原生 hook 那样通过返回值阻断、改写或继续当前会话。
- 因此 Codex 的非 Bash JSONL 观测事件统一按 `canBlock: false` 处理，即使它们最终映射成统一 hook 日志，也不能冒充 native `PreToolUse` / `PostToolUse`。
- `dynamicToolCall` 这类 transcript 形态目前还没有仓库内真实样本和集成验证，文档先不把它写成已支持。

## Gemini / Kimi 补充说明

- Gemini 真实 CLI 已验证 `BeforeTool` / `AfterTool` 会映射成统一 `PreToolUse` / `PostToolUse`，并保持 `canBlock: true`。
- Kimi 当前原生 hooks 覆盖 `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`，未发现 compaction 类事件入口。

## 统一输入语义

- `adapter`：`claude-code` / `codex` / `gemini` / `kimi` / `opencode`
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
