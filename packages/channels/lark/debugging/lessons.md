# 经验与坑位

## 先记住这些通用结论

- 一定要先从 DB 里拿到“当前这一轮”的 `sessionId`，再看对应的 `.logs/<sessionId>/server.log.jsonl`。同一个 Lark 会话里可能已经积累了多轮历史问题和历史快捷气泡，只看 UI 很容易串台。
- 如果只是想验证完整闭环，优先直接回复文本选项，而不是点击旧消息附近同名的快捷气泡。长会话里可能同时存在多轮相同选项，文本回复更不容易点错历史节点。
- 区分清楚 `Queued interaction request`、`Delivered interaction request to bound channel`、`Received interaction response from channel` / `Resolved interaction response`。只看到排队，不代表用户已经能在 Lark 里看到题目。
- 对 channel-only 会话，不能把“DB 里有绑定”直接当成“当前一定可投递”。更稳的判断是：题目真的下发成功了，或者当前还有活跃 websocket。
- 调试权限问题时，要同时看 adapter 启动参数和 settings 文件；只看到 `defaultMode = bypassPermissions` 还不够，headless 模式下往往还需要真实 CLI flag 才能生效。
- MCP 工具拿 server API 结果时，要确认解包的是统一 envelope 里的真实结果，不能把 `success/data/result` 外层对象直接当最终答案。

## 容易混淆的边界

- `interaction_request` 和普通 assistant 文本是两条不同的出站分支，调试时不要混看。
- 用户对问题的回复必须在 channel 层优先被消费成 `interaction_response`；否则模型会把选项文本当作新的普通输入，链路会偏。
- 快捷气泡更适合单选；多选或长会话复验时，直接回复文本通常更稳。
