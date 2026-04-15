---
name: vf-cli-quickstart
description: 快速说明 Vibe Forge CLI 的常用命令、会话查看和基础技能选择方式。
---

在需要指导用户或代理如何使用 `vf` CLI 时使用这个 skill。

## 常用命令

- `vf "任务描述"`：直接执行一次任务。
- `vf run --adapter codex --print "任务描述"`：以 print 模式输出事件与最终结果。
- `vf list`：查看最近的 CLI 会话。
- `vf list --view default`：显示 adapter、model 等常用列。
- `vf list --view full`：显示 context、PID 和辅助命令。
- `vf --resume <sessionId>`：恢复已有会话。
- `vf stop <sessionId>`：优雅停止运行中的会话。
- `vf kill <sessionId>`：强制终止运行中的会话。
- `vf clear`：清理本地缓存和日志。

## 技能与资产

- CLI 默认会注入 `@vibe-forge/plugin-cli-skills`。
- 这组插件当前包含 `vf-cli-quickstart` 和 `vf-cli-print-mode` 两个 skill。
- 需要显式加载某个 skill 时，使用 `--include-skill <name>`。
- 需要排除某个 skill 时，使用 `--exclude-skill <name>`。
- 例子：`vf run --include-skill vf-cli-quickstart "教我怎么恢复一个失败的会话"`

## 建议说明方式

- 先给出最短可执行命令。
- 再补 `list` / `resume` / `stop` 等排查命令。
- 如果涉及 print 模式、权限确认或 stdin 控制，继续阅读 `vf-cli-print-mode`。
