---
name: vf-cli-quickstart
description: 快速说明 Vibe Forge CLI 的常用命令、配置命令、会话查看和基础技能选择方式。
---

在需要指导用户或代理如何使用 `vf` CLI 时使用这个 skill。

## 常用命令

- `vf "任务描述"`：直接执行一次任务。
- `vf run --adapter codex --print "任务描述"`：以 print 模式输出事件与最终结果。
- `vf list`：查看最近的 CLI 会话。
- `vf list --view default`：显示 adapter、model 等常用列。
- `vf list --view full`：显示 context、PID 和辅助命令。
- `vf --resume <sessionId>`：恢复已有会话。
- `vf --resume <sessionId> --permission-mode bypassPermissions`：恢复已有会话，并覆盖下一次运行的权限模式。
- `vf stop <sessionId>`：优雅停止运行中的会话。
- `vf kill <sessionId>`：强制终止运行中的会话。
- `vf clear`：清理本地缓存和日志。

## 配置命令

- `vf config list`：查看 merged config 下哪些 section 当前有值。
- `vf config list models`：读取 `models` 视图。
- `vf config get general.defaultModel`：读取某个配置值。
- `vf config set general.defaultModel gpt-5.4 --type string`：写入配置值。
- `vf config unset general.defaultModel`：删除配置值。
- `vf config list` / `vf config get` 默认读 merged config；只有显式传 `--source project|user|all` 才切换来源。
- 文本模式默认输出 YAML；`--json` 输出原始结构化结果。
- `vf config get models` / `vf config list models` 在文本模式下会把 `modelServices` 里的模型列表与 `models` 里的 metadata 合并成人类可读视图；如果需要底层原始 metadata map，使用 `--json`。

## 技能与资产

- CLI 默认会注入 `@vibe-forge/plugin-cli-skills`。
- 这组插件当前包含 `vf-cli-quickstart`、`vf-cli-print-mode`、`create-entity` 和 `update-entity` 四个 skill。
- 通常直接描述需求即可；需要强制指定某个 skill 时，使用 `--include-skill <name>`。
- 需要排除某个 skill 时，使用 `--exclude-skill <name>`。
- 例子：`vf run --include-skill vf-cli-quickstart "教我怎么恢复一个失败的会话"`
- 例子：`vf "帮我创建一个前端评审实体"`
- 例子：`vf "给 frontend-reviewer 加上移动端布局记忆"`

## 建议说明方式

- 先给出最短可执行命令。
- 再补 `list` / `resume` / `stop` 或 `config get` / `config set` 等排查命令。
- 如果用户提到模型列表、`gpt-responses` 或 `models` section，优先说明 `modelServices` 才是服务模型来源，`models` 是 metadata；必要时补一句 CLI 文本模式会对 `models` 做展开展示。
- 如果涉及 print 模式、权限确认或 stdin 控制，继续阅读 `vf-cli-print-mode`。
- 如果涉及创建 entity，继续阅读 `create-entity`。
- 如果涉及更新已有 entity，继续阅读 `update-entity`。
