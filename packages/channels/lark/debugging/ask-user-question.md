# AskUserQuestion 链路

## 适用场景

- Lark 会话里收不到题目。
- 用户已经回复了题目，但模型没有继续执行。
- 你要确认 adapter、server、channel、MCP 之间到底卡在哪一层。

## 关键链路

`AskUserQuestion` 在 channel 模式下的关键链路是：

1. adapter 内工具调用 `/api/interact/ask`
2. server 生成 `interaction_request`
3. channel 把问题发回 Lark，会尽量附带快捷气泡
4. 用户在 Lark 回复
5. channel 把这条回复回填为 `interaction_response`
6. adapter 继续执行，并把最终结果再发回 Lark

## Claude Code 的两个重点

对于 Claude Code adapter 的 `server` runtime，要优先走 `mcp__vibe-forge__AskUserQuestion`，不要依赖 Claude 原生 `AskUserQuestion`。

原生工具在 stream-json 非交互场景下会直接失败，典型现象是日志里先出现：

- `adapter:claude-code:AskUserQuestion`

随后马上出现 tool result error，再退化成模型自己发一条普通文本问题。

对于 `bypassPermissions`，在 Claude Code 的 headless / `--print` 场景里，不能只把权限模式写进 settings 的 `defaultMode`。
要确认 adapter 最终真的把权限模式透传成 CLI 启动参数；否则 MCP 工具仍可能报“还没有获得权限”。

## 排查顺序

- 当前 session runtime 是否存在
- 这个 session 是否仍然绑定在 `channel_sessions`
- 问题有没有被下发成一条 Lark 文本消息
- 用户回复有没有被当成 `interaction_response` 消费，而不是继续当普通用户消息喂给模型

如果第 2 步失败，常见表现是 `interaction_not_active`。

## 一轮最小复现建议

用一条强约束消息逼模型走工具，不要先测开放式问题。

推荐做法：

- 让模型“不要直接回答，必须调用 AskUserQuestion”
- 给一个明确问题
- 给 2 到 3 个选项
- 要求它在收到回答后再继续

这样更容易从 Lark UI、DB 状态和 session 日志同时观察到完整链路。
