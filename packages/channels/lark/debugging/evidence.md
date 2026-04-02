# 证据采集

## 阅读顺序

先看 DB，再看 session 日志。

原因很简单：DB 用来确认“当前这一轮”到底是哪个 `sessionId`，日志才告诉你这一轮具体卡在哪个桥接层。

## DB

默认 server DB 位置受 `DB_PATH` 和进程 `HOME` 影响。

常见两种位置：

- 真实 HOME：`~/.vf/db.sqlite`
- 仓库 mock HOME：`<repo>/.ai/.mock/.vf/db.sqlite`

排查时优先看两张表：

```sql
select * from channel_sessions order by updatedAt desc limit 20;
select id, title, status, lastMessage, lastUserMessage, createdAt from sessions order by createdAt desc limit 20;
```

`channel_sessions` 用来确认某个 Lark 会话当前绑定到了哪个 `sessionId`。

## 日志

server session 日志默认在：

```bash
.logs/<sessionId>/server.log.jsonl
```

排查 `AskUserQuestion` 时，重点看：

- `Queued interaction request`
- `Delivered interaction request to bound channel`
- `Received interaction response from channel`
- `Resolved interaction response`
- `tool_result` 最终是不是回成了用户答案文本，而不是 `"[object Object]"`、空值或 schema error

## 怎么用日志判断问题层级

- 只有 `Queued interaction request`：优先看 server 是否真的把事件继续派发给 channel manager，而不是只发给 websocket runtime。
- 有 `Delivered interaction request to bound channel`，但用户没有回复后续：优先看 Lark UI 是否真的展示了题目，以及 reply 是否进入了当前会话。
- 用户已经答题，但模型没有继续：优先看 MCP tool 返回值是否正确解包了 server API 的 envelope。

server 的 `/api/*` 默认会包成 `success/data`，工具侧通常要从 `data.result` 里取真正答案。
