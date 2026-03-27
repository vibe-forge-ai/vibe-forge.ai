# Claude Code Adapter

## 文档入口

- `docs/HOOKS.md`
  - 通用 hooks 方案、事件矩阵、`.ai/.mock` 托管配置布局
- `docs/HOOKS-REFERENCE.md`
  - 真实 CLI 验证命令、本次改造经验、共用实现入口
- `apps/cli/src/AGENTS.md`
  - CLI hook bridge、`call-hook.js` 与 session logger 入口

## 目录职责

- `src/runtime/prepare.ts`
  - 组装 Claude Code / CCR 的执行参数
  - 处理 session mode、settings、mcp config、model 与运行环境
- `src/runtime/session.ts`
  - adapter 主运行入口
  - 负责 spawn CLI、消费 stdout/stderr、把事件转成 adapter output
- `src/runtime/init.ts`
  - adapter 初始化逻辑
  - 适合排查 `npx vf init`、mock home、router restart 一类问题
- `src/runtime/native-hooks.ts`
  - 负责把 `.ai/.mock/.claude/settings.json` 写成托管 native hooks 配置
  - Claude Code 的原生 hooks 最终会回调 `apps/cli/claude-hook.js`
- `src/ccr/default-config.ts`
  - 生成 CCR 默认配置
  - 决定默认注入哪些 transformer、provider/router 如何路由
- `src/ccr-transformers/*.js`
  - CCR 请求/响应变换层
  - 这里的日志是 adapter 内部排查日志，不等同于主会话 logger.debug
- `src/protocol/*.ts`
  - Claude Code 输出事件解析与内容适配
- `src/adapter-config.ts`
  - adapter 配置类型入口，先看这里确认有哪些配置面

## Hooks 维护入口

- `src/runtime/native-hooks.ts`
  - 负责把 `.ai/.mock/.claude/settings.json` 写成托管 hooks 配置
- `src/runtime/prepare.ts`
  - 注入 session 运行参数、native hook env、settings 与 mcp config
- `src/runtime/init.ts`
  - adapter 初始化阶段写 mock home、生成 CCR 配置、必要时重启 router
- `apps/cli/claude-hook.js`
- `apps/cli/src/hooks/claude.ts`
- `apps/cli/call-hook.js`
- `packages/core/src/hooks/native.ts`
- `packages/core/src/hooks/bridge.ts`
- `packages/core/src/controllers/task/run.ts`

职责边界要保持清楚：

- Claude adapter 只负责 native settings 写入与运行参数装配
- CLI hook bridge 负责把 Claude 原生 payload 翻译成统一 hook 协议
- core 负责插件执行、日志、native/bridge 去重

## 真实 CLI 验证

不要只看 unit test。至少跑一轮真实 Claude Code：

仓库根快捷命令：

```bash
pnpm smoke:hooks:claude
```

这条命令默认会启动本地 mock LLM server，并通过仓库根 `.ai.config.json` 里的 `hook-smoke-mock` model service 驱动 Claude Code。
这里走的是 `hook-smoke-mock-ccr`，也就是 `/chat/completions` 路径；比走 Responses polyfill 更稳定。

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
- `.ai/logs/<ctxId>/<sessionId>.log.md` 出现 `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`
- `.ai/.mock/.claude/settings.json` 仍指向 Vibe Forge 托管 hook bridge

这次开发里，Claude 额外要记住两点：

- 仓库根如果已有 `.claude/settings.json`，Claude 会和 mock home settings 一起加载，容易出现双触发
- 排查重复 hook 时，不要只看 `.ai/.mock/.claude/settings.json`，也要检查项目级 `.claude/settings.json`

## 调试路由

### 1. `npx vf ... --print` 没有输出、输出格式异常、resume/create 行为不对

先读：
- `src/runtime/prepare.ts`
- `src/runtime/session.ts`
- `src/protocol/incoming.ts`

重点确认：
- `executionType` 是 `create` 还是 `resume`
- `--print --verbose --debug --output-format stream-json --input-format stream-json` 是否按预期注入
- stdout 中的 JSONL 是否被正确解析并转成 adapter event

### 2. 主会话日志里出现了不该出现的 debug，或开启 debug 后仍没有 debug

先读：
- `packages/core/src/utils/create-logger.ts`
- `packages/core/src/env.ts`
- `packages/core/src/controllers/task/prepare.ts`

再回到本 adapter：
- `src/runtime/session.ts`

关键事实：
- 主会话日志文件：`.ai/logs/<ctxId>/<sessionId>.log.md`
- `logger.debug()` 是否展示，取决于 `resolveServerLogLevel()`
- `Claude Code CLI stdout` 属于主会话 debug 日志，不属于 transformer 文件日志

### 3. transformer 日志没有生成，或想确认 CCR 变换链路

先读：
- `src/ccr/default-config.ts`
- `src/ccr-transformers/logger.js`
- `src/ccr-transformers/openai-polyfill.js`
- `src/ccr-transformers/gemini-open-router-polyfill.js`
- `src/ccr-transformers/kimi-thinking-polyfill.js`

关键事实：
- transformer 日志文件：`.ai/logs/<ctxId>/<sessionId>/adapter-claude-code/*.log.md`
- 这是 CCR 内部诊断日志，和主会话 `.log.md` 的 debug 开关是两套概念
- 排查“为什么某个 transformer 没生效”时，优先看 `default-config.ts` 里是否被注入

### 4. `npx vf init`、hook、plugin logger 的日志级别不对

先读：
- `apps/cli/src/commands/init.ts`
- `apps/cli/src/hooks/index.ts`
- `apps/cli/src/hooks/claude.ts`
- `src/runtime/native-hooks.ts`
- `packages/core/src/utils/create-logger.ts`
- `packages/core/src/env.ts`

关键事实：
- CLI init 和 hooks 不是从 adapter 内部直接创建 logger，而是走 CLI/core 入口
- Claude Code native hooks 的托管配置写在 `.ai/.mock/.claude/settings.json`
- 所以这类问题不要只盯着 adapter

### 5. server 控制台 / session jsonl 日志级别不对

先读：
- `apps/server/src/utils/logger.ts`
- `packages/core/src/env.ts`

关键事实：
- server pino logger 和会话 markdown logger 不是同一实现
- 但应共享同一套 log level 解析规则

## 推荐排查顺序

### 场景 A: 先复现 CLI 现象

执行：
- `npx vf init`
- `npx vf clear`
- `npx vf 你好 --print`

如果需要对比 debug 开关，再执行：
- `__VF_PROJECT_AI_SERVER_DEBUG__=true npx vf 你好 --print`

### 场景 B: 只看本次运行生成的日志

不要直接全量 grep `.ai/logs`。

推荐做法：
- `touch /tmp/<marker>`
- 执行复现命令
- `find .ai/logs -type f -newer /tmp/<marker> | sort`

这样可以避免被历史会话或并发会话误导。

### 场景 C: 根据日志类型决定继续看哪里

- 如果是主会话日志中的 `__D__` / `Claude Code CLI stdout`
  - 继续看 `packages/core/src/*logger*` 与 `src/runtime/session.ts`
- 如果是 `adapter-claude-code/*.log.md`
  - 继续看 `src/ccr/default-config.ts` 与 `src/ccr-transformers/*.js`
- 如果根本没有生成会话日志
  - 回到 CLI 入口与 `packages/core/src/controllers/task/prepare.ts`

## 经验约定

- 先确认问题属于哪一层：
  - CLI 入口
  - core logger
  - adapter runtime
  - CCR transformer
  - server pino

- 不要把 “主会话 debug 是否展示” 和 “transformer 是否写文件” 当成同一个开关。

- 修改日志策略后，至少回归：
  - `pnpm exec vitest run packages/core/__tests__/create-logger.spec.ts packages/core/__tests__/env.spec.ts`
  - `pnpm exec vitest run packages/adapters/claude-code/__tests__/default-config.spec.ts`
  - `pnpm exec tsc -p tsconfig.json --noEmit`
