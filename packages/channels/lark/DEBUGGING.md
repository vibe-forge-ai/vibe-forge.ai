# Lark Channel Debugging

本文件是 Lark channel 调试入口页，只保留总览与阅读顺序；具体方法和经验拆到 `debugging/`。

## 先看这些

- [环境准备](./debugging/setup.md)：Chrome 调试端口、登录态和最小可用检查。
- [浏览器自动化](./debugging/browser-automation.md)：`chrome-debug` 命令、会话选择和常见 UI 操作。
- [AskUserQuestion 链路](./debugging/ask-user-question.md)：交互请求从 adapter 到 Lark 再回填的关键路径。
- [证据采集](./debugging/evidence.md)：DB、session 日志和推荐阅读顺序。
- [经验与坑位](./debugging/lessons.md)：这次排查沉淀下来的通用结论。

## 按场景阅读

- 只是要让脚本控制 Lark messenger：先看 [环境准备](./debugging/setup.md)，再看 [浏览器自动化](./debugging/browser-automation.md)。
- 用户没有明确给会话名：直接看 [浏览器自动化](./debugging/browser-automation.md) 里的“会话选择不要写死”。
- `AskUserQuestion` 没有把题目发到 Lark：先看 [AskUserQuestion 链路](./debugging/ask-user-question.md)，再用 [证据采集](./debugging/evidence.md) 对日志和 DB。
- 用户已经回复，但模型没有继续执行：先看 [证据采集](./debugging/evidence.md) 的日志判断，再回到 [AskUserQuestion 链路](./debugging/ask-user-question.md) 查桥接层。
- 想沉淀一套以后还能复用的排查方法：最后看 [经验与坑位](./debugging/lessons.md)。

## 总体原则

- 不把会话名写死；用户没指定时，先列当前可见会话，再确认目标。
- 先锁定“当前这一轮”的 `sessionId`，再读对应 `.logs/<sessionId>/server.log.jsonl`。
- 要区分 `Queued`、`Delivered`、`Received/Resolved` 三个阶段，只看到排队不代表用户已经收到了题目。
- 对 channel-only 会话，`channel_sessions` 里有绑定不等于当前一定可投递。
- 先跑最小闭环，再做复杂 UI 交互或历史消息点击。
