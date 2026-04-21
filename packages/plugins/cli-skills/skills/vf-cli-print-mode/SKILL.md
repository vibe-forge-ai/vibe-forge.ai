---
name: vf-cli-print-mode
description: 说明 vf CLI 的 print 模式、stdin 控制、权限确认和恢复会话方式。
---

在需要解释 `vf --print`、`--input-format`、权限确认或继续会话时使用这个 skill。

## Print 模式

- `vf run --print "任务描述"`：把事件和最终输出直接打印到终端。
- `--output-format text`：默认文本模式，适合直接阅读。
- `--output-format stream-json`：逐条输出结构化事件，适合脚本消费。
- `--output-format json`：任务结束时输出 JSON。

## stdin 控制

- `--input-format text`：从 stdin 读取一行纯文本作为输入。
- `--input-format json`：从 stdin 读取一个 JSON 对象。
- `--input-format stream-json`：按行读取 JSON 事件，适合长连接控制。

## 权限与继续会话

- 当 print 模式遇到 `interaction_request` 且没有可用 stdin 控制时，CLI 会打印请求并终止任务。
- 恢复时可用：`vf --resume <sessionId> --print --input-format stream-json`
- 如果只是想改下一次恢复的权限模式，可用：`vf --resume <sessionId> --permission-mode bypassPermissions`
- 对权限请求提交输入的示例：

```json
{ "type": "submit_input", "data": "allow_once" }
```

- 常见 decision：
  - `allow_once`
  - `allow_session`
  - `allow_project`
  - `deny_once`
  - `deny_session`
  - `deny_project`

## 排查顺序

1. 先执行 `vf list --view full` 找到 session id。
2. 再用 `vf --resume <sessionId>` 或 `vf --resume <sessionId> --print --input-format stream-json` 继续。
3. 如果只是想停掉卡住的会话，用 `vf stop <sessionId>` 或 `vf kill <sessionId>`。
