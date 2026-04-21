# Kimi Hooks And Assets

## Native Hooks

Kimi 官方 hooks 仍是 Beta。当前 adapter 只托管这些事件：

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `PreCompact`
- `Stop`

`PreToolUse` 和 `PostToolUse` matcher 当前写 `.*`，由 Vibe Forge hook runtime 继续做权限、插件和内置 permission 逻辑。
`PreCompact` 当前会继续透传 Kimi 原生 payload 里的 `trigger` / `token_count`，并保持可阻断语义。

托管配置会写入 generated JSON config，或在复制到的 TOML config 中插入：

```text
# Vibe Forge managed Kimi hooks start
...
# Vibe Forge managed Kimi hooks end
```

## Hook Bridge

[kimi-hook.js](../../kimi-hook.js) 的行为边界：

- stdin 读取 Kimi hook payload，转换成 Vibe Forge hook input。
- `permissionDecision: "deny"` 走 Kimi 官方结构化输出，由 Kimi 自己阻断。
- `continue === false` 且事件可阻断时，stderr 写 reason 并 `exit 2`。
- hook runtime 崩溃、超时或 wrapper 异常时 fail-open，避免 Kimi session 被 bridge 故障卡死。
- `Stop` 当前标记为不可阻断；需要阻断 Stop 时先确认官方语义和 Vibe Forge hook contract。

新增 Kimi native 事件时，同时更新：

- [src/runtime/native-hooks.ts](../../src/runtime/native-hooks.ts)
- [kimi-hook.js](../../kimi-hook.js)
- [packages/task/src/run.ts](../../../../../packages/task/src/run.ts)
- [packages/hooks/src/builtin-permissions.ts](../../../../../packages/hooks/src/builtin-permissions.ts)
- [apps/server/src/services/session/permission.ts](../../../../../apps/server/src/services/session/permission.ts)
- [tests/native-hooks.spec.ts](../../__tests__/native-hooks.spec.ts)

## 去重边界

native hooks 开启后，[packages/task/src/run.ts](../../../../../packages/task/src/run.ts) 必须继续禁用重复的 framework bridge 事件。adapter 层只负责写 Kimi-native config 和 payload 翻译，hooks runtime 负责插件执行，task runtime 负责 native/bridge 去重。

## Skills 与 Workspace Assets

Kimi 支持 `--skills-dir`，所以 workspace skill overlay 走 native skills 目录。当前 session 会把 asset plan 中的 skill overlay 软链到：

```text
.ai/caches/<ctxId>/<sessionId>/adapter-kimi/skills
```

维护点：

- [packages/workspace-assets](../../../../../packages/workspace-assets/AGENTS.md) 把 Kimi 标记为 native skill adapter。
- hook plugins 对 Kimi 是 native hooks，不要额外生成 OpenCode plugin overlay。
- Kimi 的 `--skills-dir` 可以重复追加；当前 adapter 只传 session overlay 目录。
