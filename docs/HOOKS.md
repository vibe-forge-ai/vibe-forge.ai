# 通用 Hooks 方案

Vibe Forge 现在对 `claude-code`、`codex`、`opencode` 统一采用一套 native hooks 接入思路：

1. 初始化 adapter 时，在工作区的 `.ai/.mock` 下生成托管配置。
2. 各家 agent 的原生 hooks / plugin 机制都只回调 Vibe Forge 的同一个 hook runtime。
3. `TaskStart / TaskStop / SessionEnd` 这类框架事件仍由 Vibe Forge 自己触发，不绑定某一家 agent 的私有协议。

这意味着三家 adapter 可以共享同一套 `plugins.<name>` hook 插件实现，不需要为每个 agent 单独写一套业务逻辑。

维护与排查参考见 [`docs/HOOKS-REFERENCE.md`](./HOOKS-REFERENCE.md)。

## 初始化后会生成什么

当 workspace 配置了 hook 插件时，adapter init 会在 `.ai/.mock` 下安装托管配置：

| Adapter | 托管文件 |
| --- | --- |
| `claude-code` | `.ai/.mock/.claude/settings.json` |
| `codex` | `.ai/.mock/.codex/hooks.json` |
| `opencode` | `.ai/.mock/.config/opencode/opencode.json` |
| `opencode` | `.ai/.mock/.config/opencode/plugins/vibe-forge-hooks.js` |

说明：

- 这些文件都只写到 mock home，不污染用户真实 home。
- OpenCode 不再把真实的 `~/.config/opencode` 整个软链进 mock home，而是把用户已有配置镜像进 mock config dir，再叠加托管 plugin。
- 三家的 native 配置最终都会回调 `@vibe-forge/cli/call-hook.js` 或轻量桥接脚本，再进入 `packages/core/src/hooks`。

## 事件支持矩阵

| Hook 事件 | Claude Code | Codex | OpenCode |
| --- | --- | --- | --- |
| `TaskStart` / `TaskStop` | 框架触发 | 框架触发 | 框架触发 |
| `SessionStart` | native | native | native |
| `UserPromptSubmit` | native | native | bridge |
| `PreToolUse` | native | native | native |
| `PostToolUse` | native | native | native |
| `Stop` | native | native | native |
| `SessionEnd` | bridge | bridge | bridge |
| `Notification` / `SubagentStop` / `PreCompact` | native | 不支持 | 不支持 |

说明：

- `SessionEnd` 目前统一保留给 framework bridge，因为它依赖 task 级退出状态。
- OpenCode 的 tool hooks 通过本地 plugin 接入，不再依赖 stdout 文本解析。
- OpenCode 当前没有独立的 `UserPromptSubmit` native 入口，所以这一项仍由 bridge 负责。

## 统一输入语义

进入 Vibe Forge hook runtime 的输入会补齐这些统一字段：

- `adapter`: `claude-code` / `codex` / `opencode`
- `runtime`: `cli` / `server` / 其他 `AdapterQueryOptions.runtime` 值
- `hookSource`: `native` 或 `bridge`
- `canBlock`: 当前事件是否还能真正阻止动作继续

建议按下面理解：

- `canBlock: true`
  - `TaskStart`
  - `SessionStart`
  - `UserPromptSubmit`
  - native `PreToolUse`
  - native `PostToolUse`
  - `PreCompact`
- `canBlock: false`
  - bridge 观测到的 tool hooks
  - `Stop`
  - `SessionEnd`
  - `Notification`
  - `SubagentStop`

## 运行时去重

native hooks 可用时，Vibe Forge 会关闭对应的 bridge 事件，避免同一个事件被打两次：

- `claude-code`: `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`
- `codex`: `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`
- `opencode`: `SessionStart` / `PreToolUse` / `PostToolUse` / `Stop`

## 如何启用

在 `.ai.config.json`、`.ai.config.yaml` 或 `.ai.config.ts` 里声明 hook 插件即可：

```yaml
plugins:
  logger: {}
```

上面的 `logger` 会解析为 workspace 包 `@vibe-forge/plugin-logger/hooks`。

如果没有配置任何 hook 插件：

- 托管配置仍会保持在 mock 目录下
- 但 native hook 桥接不会被标记为 active
- 运行时不会关闭 bridge，也不会额外执行业务 hook

## 调试建议

如果你想确认 native 配置是否已经落地，优先看这些文件：

- `.ai/.mock/.claude/settings.json`
- `.ai/.mock/.codex/hooks.json`
- `.ai/.mock/.config/opencode/opencode.json`
- `.ai/.mock/.config/opencode/plugins/vibe-forge-hooks.js`

如果你想确认最终执行的是哪条业务 hook，看 `.ai/logs/<ctxId>/<sessionId>/` 下的 hook 日志。

## 真实 CLI 验证

验证 hooks 时，不要只跑单元测试，至少补一轮真实 CLI：

- 标准入口：
  - `pnpm test:e2e:adapters`
- 快速入口：
  - `pnpm tools adapter-e2e run codex`
  - `pnpm tools adapter-e2e run claude-code`
  - `pnpm tools adapter-e2e run opencode`
  - `pnpm tools adapter-e2e run all`
- 维护 snapshot：
  - `pnpm tools adapter-e2e test codex-read-once --update`
  - `pnpm tools adapter-e2e test codex-direct-answer --update`
  - `pnpm tools adapter-e2e test all --update`
- `test:e2e:adapters` 基于 Vitest 跑完整的离线 adapter E2E，用 `scripts/adapter-e2e/` 下的共享 TypeScript harness 校验真实 CLI 结果、native 配置落地、日志脱敏和 hook 事件。
- 每个 case 的定义、Vitest spec 和预期快照都集中在 `scripts/__tests__/adapter-e2e/`；快照文件在 `scripts/__tests__/adapter-e2e/__snapshots__/*.snapshot.json`。结构化 expectations 也在 case 里定义，先校验输出 / mock trace / hook 计数，再落 snapshot。
- 这些命令默认会启动仓库内置的本地 mock LLM server，离线完成一轮真实 CLI。
- 维护命令统一收口到 `pnpm tools ...`，底层由 `scripts/run-tools.mjs` 加 `scripts/cli.ts` 驱动。
- 对应的 smoke model service 定义在仓库根 `.ai.config.json` 里：
  - `hook-smoke-mock` 给 Codex / OpenCode
  - `hook-smoke-mock-ccr` 给 Claude Code Router
- `codex`: 直接运行 `vf --adapter codex --print ...`
- `claude-code`: 直接运行 `vf --adapter claude-code --print ...`
- `opencode`: 优先运行 `vf --adapter opencode --print ...`
  - 如果包装层没有自然结束，排查时复用 `.ai/.mock/.opencode-adapter/<sessionId>/config-dir` 直接执行 `opencode run`

建议最少覆盖这组场景：

- `SessionStart`
- `UserPromptSubmit`
- 一次真实工具调用，对应 `PreToolUse` / `PostToolUse`
- 一次无工具直答，确认 `PreToolUse` / `PostToolUse` 不出现
- 模型正常结束，对应 `Stop`

验证时优先看：

- 终端最终输出是否为预期结果
- `.ai/logs/<ctxId>/<sessionId>.log.md` 是否出现对应 hook 事件
- `.ai/.mock` 下的托管配置是否仍指向 Vibe Forge 的 hook bridge 脚本

更细的真实命令、经验总结和实现入口，统一收在 [`docs/HOOKS-REFERENCE.md`](./HOOKS-REFERENCE.md)。

## 设计取舍

这套方案的关键不是“把所有 agent 都翻译成 Claude Code 的 hooks 格式”，而是：

- 用 `.ai/.mock` 承载每家 agent 的原生配置入口
- 用 Vibe Forge 的 hook runtime 承载统一业务逻辑
- 用 adapter 运行层处理 native / bridge 去重

这样做的直接结果是：

- 三家 agent 共用一套 hook 插件
- 用户真实 home 不会被自动改写
- 新接 agent 时，只需要补一层 mock 配置和事件映射，不需要再重做一遍 hook 体系
