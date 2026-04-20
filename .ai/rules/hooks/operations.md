# Hooks 启用与排查

返回入口：[HOOKS.md](../HOOKS.md)

## 如何启用

在 `.ai.config.json`、`.ai.config.yaml` 或 `.ai.config.ts` 里声明 hook 插件即可：

```yaml
plugins:
  logger: {}
```

上面的 `logger` 会解析为 workspace 包 `@vibe-forge/plugin-logger/hooks`。

如果没有配置任何 hook 插件：

- 托管配置仍会保持在 mock 目录下
- native hook 桥接不会被标记为 active
- 运行时不会关闭 bridge，也不会额外执行业务 hook

## 运行时去重

native hooks 可用时，Vibe Forge 会关闭对应的 bridge 事件，避免同一个事件被打两次：

- `claude-code`：`SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`
- `codex`：`SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`
- `gemini`：`SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`
- `kimi`：`SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`
- `opencode`：`SessionStart` / `PreToolUse` / `PostToolUse` / `Stop`

补充说明：

- `claude-code` 的 `PreCompact`、`gemini` 的 `PreCompress -> PreCompact` 与 `kimi` 的原生 `PreCompact` 都走 native hook，但当前没有对应的 bridge 重复事件需要关闭。
- `opencode` 的 `experimental.session.compacting` 已映射到统一 `PreCompact`，但它只做 compaction prompt/context 定制，当前固定按 `canBlock: false` 处理，也没有对应的 bridge 重复事件需要关闭。
- `codex` 当前通过 stream app-server `contextCompaction` 事件映射 bridge `PreCompact`；因为没有 native 返回值语义，这条链路固定按 `canBlock: false` 处理，也不会参与 native 去重。

Codex 补充说明：

- 上面的 `codex` native 去重只适用于官方原生 hooks 真正覆盖到的事件。
- 如果后续为 Codex 增加 transcript JSONL watcher 来补非 Bash 工具统计，这条链路只能作为观测补充，不能参与 native hook 决策，也不要据此关闭真正可阻断的 native hooks。
- 换句话说，Codex 的 bridge 旁路目前可以补日志和埋点，但不能承担 `PreToolUse` / `PostToolUse` / `PreCompact` 的控流职责。

## 调试入口

- 优先看 `.ai/.mock` 下的托管配置是否落地。
- 再看 `.ai/logs/<ctxId>/<sessionId>/` 下的 hook 日志。
- 修改 hooks 实现后，不要只跑单元测试；真实 CLI 验证和 snapshot 维护见 [HOOKS-REFERENCE.md](../HOOKS-REFERENCE.md)。
