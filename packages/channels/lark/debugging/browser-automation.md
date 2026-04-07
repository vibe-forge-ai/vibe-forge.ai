# 浏览器自动化

## 适用场景

- 你需要用脚本列会话、发消息、点击快捷气泡或 reply 按钮。
- 你要把一次人工点击操作固化成可复用命令，而不是每次临时写 CDP 脚本。

## 会话选择不要写死

如果用户已经明确给了会话名，直接把会话名作为 `chrome-debug` 子命令参数传入。

如果用户没有明确指定：

1. 先运行 `pnpm tools chrome-debug messenger-conversations`
2. 把当前可见候选返回给用户确认
3. 只在用户确认后，再运行 `messenger-send` / `messenger-click-*`

不要默认假设目标一定是某个固定机器人或联系人。

如果用户说“我已经打开了一个会话”但没有给出名字：

1. 先读取当前打开会话的标题或把可见候选回给用户
2. 第一次发消息前必须让用户显式确认目标会话
3. 用户确认后，本轮后续调试默认继续复用这个会话，除非用户明确要求切换

不要在第一次发消息时自行猜测“当前打开的会话”是哪一个。

## 常用命令

```bash
pnpm tools chrome-debug targets
pnpm tools chrome-debug messenger-conversations
pnpm tools chrome-debug messenger-send '<conversation>' '<message>'
pnpm tools chrome-debug messenger-click-text '<conversation>' '<text>'
pnpm tools chrome-debug messenger-click-reply '<conversation>' '<messageSnippet>'
```

## 适合解决的问题

- 定位目标页面和目标会话
- 发送调试指令，例如 `/menu`、`/reset`
- 点击快捷气泡、reply 按钮、问题选项

## 使用顺序建议

1. 先用 `targets` 确认连接的是哪一个 messenger 页面。
2. 再用 `messenger-conversations` 确认当前可见会话。
3. 最后再用 `messenger-send` 或 `messenger-click-*` 做具体动作。

## 常见误区

- 在没确认目标会话的情况下直接发消息，最容易把调试流量打到错误的聊天里。
- 用户只是说“我打开了一个”，不等于已经确认了会话名；第一次发消息前仍然要先回传目标并得到确认。
- 长会话里如果有多轮历史问题，点击同名气泡前先确认它属于当前这一轮，而不是旧消息。
