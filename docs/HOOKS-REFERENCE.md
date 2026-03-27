# Hooks 开发与维护参考

这份文档面向维护者，回答四类问题：

1. 真实 CLI 应该怎么验证，而不是只跑单元测试。
2. 本次 hooks 改造过程中踩过哪些坑。
3. 三家 adapter 的实现入口分别在哪里。
4. 后续继续演进时，怎样尽量保持 clean 和可维护。

用户侧使用说明仍以 [HOOKS.md](./HOOKS.md) 为准；这里主要记录维护经验与实现参考。

## 文档入口

- 通用方案与事件矩阵：[`docs/HOOKS.md`](./HOOKS.md)
- CLI hook bridge 维护说明：[`apps/cli/src/AGENTS.md`](../apps/cli/src/AGENTS.md)
- Codex adapter 维护说明：[`packages/adapters/codex/AGENTS.md`](../packages/adapters/codex/AGENTS.md)
- Claude Code adapter 维护说明：[`packages/adapters/claude-code/AGENTS.md`](../packages/adapters/claude-code/AGENTS.md)
- OpenCode adapter 维护说明：[`packages/adapters/opencode/AGENTS.md`](../packages/adapters/opencode/AGENTS.md)

## 真实 CLI 验证

### 通用原则

- 不要只依赖 `vitest`。至少要让真实 CLI 完整经过一轮 `SessionStart -> UserPromptSubmit -> PreToolUse -> PostToolUse -> Stop`。
- 每轮验证都固定 `ctxId` 和 `sessionId`，方便在 `.ai/logs/` 下定位日志。
- 验证时优先检查三件事：
  - 终端最终输出是否符合预期。
  - `.ai/logs/<ctxId>/<sessionId>.log.md` 是否落下对应 hook 事件。
  - `.ai/.mock` 下的托管配置是否仍指向 Vibe Forge hook bridge。
- 仓库根已经固化了 smoke 命令：
  - `pnpm smoke:hooks:codex`
  - `pnpm smoke:hooks:claude`
  - `pnpm smoke:hooks:opencode`
  - `pnpm smoke:hooks:all`
- 这组命令默认启动本地 mock LLM server，不依赖外部模型服务。
- 对应的 smoke model service 配置写在仓库根 `.ai.config.json`：
  - `modelServices.hook-smoke-mock` 给 Codex / OpenCode
  - `modelServices.hook-smoke-mock-ccr` 给 Claude Code Router
- `smoke:hooks:opencode` 会先试包装层，超时后自动 fallback 到 upstream `opencode run --format json`。

### Codex

仓库内建议直接运行：

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-codex' \
node apps/cli/cli.js \
  --adapter codex \
  --model hook-smoke-mock,codex-hooks \
  --print \
  --no-inject-default-system-prompt \
  --exclude-mcp-server ChromeDevtools \
  --session-id '<uuid>' \
  "Use the Read tool exactly once on README.md, then reply with exactly E2E_CODEX and nothing else."
```

通过标准：

- 终端输出 `E2E_CODEX`
- `.ai/logs/<ctxId>/<sessionId>.log.md` 里出现 `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`

### Claude Code

仓库内建议固定模型与工具面，避免把不确定性放大：

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-claude' \
node apps/cli/cli.js \
  --adapter claude-code \
  --model 'hook-smoke-mock-ccr,claude-hooks' \
  --print \
  --no-inject-default-system-prompt \
  --exclude-mcp-server ChromeDevtools \
  --include-tool Read \
  --permission-mode bypassPermissions \
  --session-id '<uuid>' \
  "Use the Read tool exactly once on README.md, then reply with exactly E2E_CLAUDE and nothing else."
```

通过标准：

- 终端输出 `E2E_CLAUDE`
- `.ai/logs/<ctxId>/<sessionId>.log.md` 里出现 `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`

### OpenCode

优先尝试包装层：

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-opencode' \
node apps/cli/cli.js \
  --adapter opencode \
  --model hook-smoke-mock,opencode-hooks \
  --print \
  --no-inject-default-system-prompt \
  --exclude-mcp-server ChromeDevtools \
  --session-id '<uuid>' \
  "Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else."
```

如果包装层没有自然结束，排查时直接复用 session config dir 调 upstream：

```bash
HOME="$PWD/.ai/.mock" \
OPENCODE_CONFIG_DIR="$PWD/.ai/.mock/.opencode-adapter/<sessionId>/config-dir" \
__VF_VIBE_FORGE_OPENCODE_HOOKS_ACTIVE__='1' \
__VF_PROJECT_WORKSPACE_FOLDER__="$PWD" \
__VF_PROJECT_NODE_PATH__="$(which node)" \
__VF_PROJECT_REAL_HOME__="$HOME" \
__VF_PROJECT_CLI_PACKAGE_DIR__="$PWD/apps/cli" \
__VF_PROJECT_PACKAGE_DIR__="$PWD/apps/cli" \
__VF_OPENCODE_TASK_SESSION_ID__='<sessionId>' \
__VF_OPENCODE_HOOK_RUNTIME__='cli' \
packages/adapters/opencode/node_modules/.bin/opencode run \
  --print-logs \
  --format json \
  --model opencode/gpt-5-nano \
  --dir "$PWD" \
  "Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else."
```

当前经验上，OpenCode 的 upstream 直跑是更稳定的基准验证路径。

## 本次开发经验

### 1. 真实 CLI 和单元测试解决的是两类问题

- 单测能覆盖配置写入、bridge 去重、参数拼装。
- 真实 CLI 才能暴露认证、配置装载顺序、插件发现、进程退出条件等问题。
- 结论：hooks 相关改动合并前，三家都必须至少有一轮真实 CLI smoke。

### 2. OpenCode 更适合以 JSON 事件流作为稳定执行基线

- `opencode run --format default` 在非交互子进程里更容易卡住或难以可靠提取最终文本。
- `opencode run --format json` 更适合 adapter 消费，也更利于排查 tool 事件。
- 如果要看 upstream 是否正常工作，先用 session config dir 直接跑 `opencode run --format json`。

### 3. OpenCode 配置不能只靠 `OPENCODE_CONFIG_CONTENT`

- 只塞环境变量容易和插件目录、基础配置、session config dir 的装载顺序打架。
- 更稳妥的方式是：先准备 session config dir，再把运行时 config 落成真实 `opencode.json`。
- 如果 session config dir 里 `plugins/` 为空、`opencode.json` 被覆盖成空对象，先查 `src/runtime/session/child-env.ts` 和 `src/runtime/session/skill-config.ts`。

### 4. Claude Code 会叠加项目级和 mock home 两套 settings

- 仓库根如果已经有 `.claude/settings.json`，Claude 会一起加载。
- mock home 再注入一套托管 hooks 后，容易出现双触发。
- 所以排查 Claude 重复 hook 时，不要只看 `.ai/.mock/.claude/settings.json`，还要看项目级 `.claude/settings.json`。

### 5. 日志不要直接打完整输入对象

- `TaskStart` / `SessionStart` 输入里可能带整包环境变量。
- 一旦 `logger.info(input)` 原样落盘，`.ai/logs` 就可能包含 token、api key、secret。
- hooks/logger 默认必须做脱敏，尤其是 `env`、`apiKey`、`token`、`secret`、`authorization`。

### 6. 文档只能写已经验证过的路径

- 如果某条验证路径当前还不稳定，就把它写成“优先尝试”或“已知问题”，不要写成既成事实。
- 特别是 OpenCode 包装层与 upstream 直跑可能出现行为差异，这一点要在文档中明确。

## 实现参考

### 共用层

- `packages/core/src/hooks/native.ts`
  - mock home、托管脚本路径、native 配置写入的共用 helper
- `packages/core/src/hooks/bridge.ts`
  - 结构化 `tool_use/tool_result` 到统一 hook 事件的桥接
- `packages/core/src/controllers/task/run.ts`
  - native / bridge 去重策略
- `packages/core/src/utils/workspace-assets.ts`
  - workspace hook 插件、native 资产、overlay 规划
- `apps/cli/src/hooks/*.ts`
  - CLI 侧 hook 入口
- `apps/cli/codex-hook.js`
- `apps/cli/claude-hook.js`
- `apps/cli/call-hook.js`

### Codex

- `packages/adapters/codex/src/runtime/native-hooks.ts`
  - `.ai/.mock/.codex/hooks.json` 生成
- `packages/adapters/codex/src/runtime/session-common.ts`
  - model provider、feature flag、runtime config 注入
- `packages/adapters/codex/src/runtime/session.ts`
  - app-server / CLI 运行时

### Claude Code

- `packages/adapters/claude-code/src/runtime/native-hooks.ts`
  - `.ai/.mock/.claude/settings.json` 托管 hooks
- `packages/adapters/claude-code/src/runtime/prepare.ts`
  - session 参数、settings、mcp config、native hook env
- `packages/adapters/claude-code/src/runtime/init.ts`
  - CCR config 生成与 restart
- `packages/adapters/claude-code/src/ccr/default-config.ts`
  - provider/router 默认配置

### OpenCode

- `packages/adapters/opencode/src/runtime/native-hooks.ts`
  - `.ai/.mock/.config/opencode/plugins/vibe-forge-hooks.js`
- `packages/adapters/opencode/src/runtime/session/child-env.ts`
  - session config dir、runtime opencode.json、provider config
- `packages/adapters/opencode/src/runtime/session/skill-config.ts`
  - base config/skills/plugins 镜像与 overlay
- `packages/adapters/opencode/src/runtime/session/stream.ts`
  - JSON 事件流消费与最终 assistant 输出提取
- `packages/adapters/opencode/src/runtime/common/tools.ts`
  - `opencode run` 参数构造

## Clean 维护清单

- 新增 hook 能力时，先判断属于 native 配置、bridge、还是 runtime 去重，不要把职责混写。
- 任何 adapter 的真实 CLI 验证都要留下：
  - 复现命令
  - 最终输出
  - 对应日志路径
- 避免在 adapter 中直接堆业务日志格式化；优先让 `packages/plugins/logger` 负责展示层。
- 修改 OpenCode 运行时后，至少回归：
  - `packages/adapters/opencode/__tests__/native-hooks.spec.ts`
  - `packages/adapters/opencode/__tests__/session-runtime-config.spec.ts`
  - `packages/core/__tests__/run.spec.ts`
  - `pnpm exec tsc -p tsconfig.json --noEmit`
- 修改 Claude/Codex native hook 安装逻辑后，务必检查项目级配置是否会造成重复触发。
