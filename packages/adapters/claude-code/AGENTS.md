# Claude Code Adapter

## 文档入口

- `.ai/rules/HOOKS.md`
  - 通用 hooks 方案、事件矩阵、`.ai/.mock` 托管配置布局
- `.ai/rules/HOOKS-REFERENCE.md`
  - 真实 CLI 验证命令、维护经验、共用实现入口
- `apps/cli/src/AGENTS.md`
  - CLI hook bridge、`call-hook.js` 与 session logger 入口

## 目录职责

- `src/claude/*.ts`
  - Claude CLI 会话生命周期
  - `prepare.ts` 组装执行参数与 settings，`session.ts` 负责 spawn/stream，`init.ts` 只做 adapter 初始化
- `src/hooks/*.ts`
  - Claude native hooks 的托管配置与 bridge 逻辑
  - `native.ts` 写 `.ai/.mock/.claude/settings.json`，`bridge.ts` 把 Claude payload 翻译成统一 hook 协议
- `src/ccr/*.ts`
  - Claude Code Router 的配置、路径解析与 daemon 复用
  - `config.ts` 生成 router 配置，`daemon.ts` 负责 pid 检查、按需重启与 ready wait
- `src/ccr/transformers/*.ts`
  - CCR 请求/响应变换层
  - 这里的日志是 adapter 内部排查日志，不等同于主会话 logger.debug
- `src/protocol/*.ts`
  - Claude Code 输出事件解析与内容适配
- `src/adapter-config.ts`
  - adapter 配置类型入口，先看这里确认有哪些配置面

## Hooks 维护入口

- `src/hooks/native.ts`
  - 负责把 `.ai/.mock/.claude/settings.json` 写成托管 hooks 配置
- `src/claude/prepare.ts`
  - 注入 session 运行参数、native hook env、settings 与 mcp config
- `src/claude/init.ts`
  - adapter 初始化阶段安装 Claude native hooks；router 生命周期由 `src/ccr/daemon.ts` 接管
- `src/hooks/bridge.ts`
  - 负责把 Claude native payload 翻译成统一 hook 协议
- `packages/hooks/call-hook.js`
- `packages/hooks/src/entry.ts`
- `packages/hooks/src/native.ts`
- `packages/hooks/src/bridge.ts`
- `packages/task/src/run.ts`

职责边界要保持清楚：

- Claude adapter 负责 native settings 写入、运行参数装配和 Claude 协议翻译
- CLI hook bridge 只负责把入口分发到 adapter / hooks runtime
- hooks runtime 负责插件执行与日志，task runtime 负责 native/bridge 去重

## 维护经验

### 1. 优先让导出直接指向真实实现

- 原则：如果包导出可以直接落到真实实现文件，就不要为了“路径好看”再增加一层只做转发的空壳文件。
- 这样做的好处：
  - 减少无意义的兼容层，避免后续维护时遗漏真实入口。
  - `npm pack --dry-run`、子路径导出检查和源码检索都更直接。
- 本包里的例子：
  - `./hook-bridge` 直接指向 `src/hooks/bridge.ts`，不再保留根级透传文件。
  - Claude 协议类型统一收口在 `src/protocol/types.ts`，不再散放在根目录。

### 2. 后台基础设施优先复用，不要按调用包一层壳

- 原则：如果某个后台组件本身已经有稳定的配置、pid 和健康检查机制，优先复用常驻进程，而不是在每次调用时再套一层启动包装。
- 这样做的好处：
  - 更容易控制启动时机、配置变更和重启条件。
  - 更容易把“业务会话”和“后台基础设施”拆开维护。
- 本包里的例子：
  - `serviceKey,modelName` 模型通过 `src/ccr/daemon.ts` 复用 `.ai/.mock/.claude-code-router` 后台进程。
  - Claude 会话本身始终直接启动 `claude`，router 参数通过 session settings 注入，而不是继续依赖 `ccr code` 包装层。

### 3. 依赖升级要按角色区分激进度

- 原则：不要对所有外部依赖一律“跟最新”。核心上游 CLI、兼容层、路由层的升级策略应按维护风险分别制定。
- 这样做的好处：
  - 避免把高频变化但低兼容风险的依赖，和维护信号较弱的桥接依赖绑成同一升级节奏。
  - 出问题时更容易判断是上游 CLI 变化，还是中间层兼容问题。
- 本包里的例子：
  - `@anthropic-ai/claude-code` 默认跟进最新稳定版。
  - `@musistudio/claude-code-router` 默认保持在最新 `1.x`，除非已经确认 `2.x` 有明确维护信号且当前需求必须依赖其新能力。

### 4. 主会话 binary 不能依赖系统 PATH

- 原则：Claude 主会话和 CCR 都应该从 adapter 自己的依赖树解析可执行文件，不要把主会话写成裸 `claude` 然后依赖系统 `PATH`。
- 这样做的好处：
  - 避免命中全局安装、其他工作区或旧版本包里的 Claude binary。
  - 排查 `Invalid API key`、`Please run /login` 这类看起来像鉴权问题、实则是“跑错 binary”的场景时，定位更直接。
- 本包里的例子：
  - `src/ccr/paths.ts` 统一负责从依赖包 `package.json/bin` 解析 `claude` 和 `ccr`。
  - `src/claude/prepare.ts` 返回给 session 的 `cliPath` 应始终来自 `resolveClaudeCliPath()`，不要回退成系统 `PATH` 上的裸命令。

## 真实 CLI 验证

不要只看 unit test。至少跑一轮真实 Claude Code：

仓库根快捷命令：

```bash
pnpm test:e2e:adapters
pnpm tools adapter-e2e run claude-code
pnpm tools adapter-e2e test claude-read-once --update
```

这条命令默认会启动本地 mock LLM server，并通过仓库根 `.ai.config.json` 里的 `hook-smoke-mock-ccr` model service 驱动 Claude Code。
这里走的是 `/chat/completions` 路径；比走 Responses polyfill 更稳定。adapter E2E 的共享 harness 在 `scripts/adapter-e2e/`，scripts CLI 入口在 `scripts/cli.ts`。
case 定义、spec 和期望快照统一维护在 `scripts/__tests__/adapter-e2e/`。

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

Claude 维护时优先检查两点：

- 仓库默认不提交项目级 `.claude/settings.json`；Claude 托管入口是 `.ai/.mock/.claude/settings.json`
- 但如果用户自己加了项目级 `.claude/settings.json`，Claude 仍会和 mock home settings 一起加载，容易出现双触发
- 排查重复 hook 时，不要只看 `.ai/.mock/.claude/settings.json`，也要检查项目级 `.claude/settings.json`

## 调试路由

### 1. `npx vf ... --print` 没有输出、输出格式异常、resume/create 行为不对

先读：

- `src/claude/prepare.ts`
- `src/claude/session.ts`
- `src/protocol/incoming.ts`

重点确认：

- `executionType` 是 `create` 还是 `resume`
- `--print --verbose --debug --output-format stream-json --input-format stream-json` 是否按预期注入
- stdout 中的 JSONL 是否被正确解析并转成 adapter event

### 2. 主会话日志里出现了不该出现的 debug，或开启 debug 后仍没有 debug

先读：

- `packages/utils/src/create-logger.ts`
- `packages/utils/src/log-level.ts`
- `packages/core/src/env.ts`
- `packages/task/src/prepare.ts`

再回到本 adapter：

- `src/claude/session.ts`

关键事实：

- 主会话日志文件：`.ai/logs/<ctxId>/<sessionId>.log.md`
- `logger.debug()` 是否展示，取决于 `resolveServerLogLevel()`
- `Claude Code CLI stdout` 属于主会话 debug 日志，不属于 transformer 文件日志

### 3. transformer 日志没有生成，或想确认 CCR 变换链路

先读：

- `src/ccr/config.ts`
- `src/ccr/transformers/logger.ts`
- `src/ccr/transformers/openai-polyfill.ts`
- `src/ccr/transformers/gemini-open-router-polyfill.ts`
- `src/ccr/transformers/kimi-thinking-polyfill.ts`

关键事实：

- transformer 日志文件：`.ai/logs/<ctxId>/<sessionId>/adapter-claude-code/*.log.md`
- 这是 CCR 内部诊断日志，和主会话 `.log.md` 的 debug 开关是两套概念
- 排查“为什么某个 transformer 没生效”时，优先看 `config.ts` 里是否被注入

### 4. `npx vf init`、hook、plugin logger 的日志级别不对

先读：

- `apps/cli/src/commands/init.ts`
- `packages/hooks/src/entry.ts`
- `src/hooks/bridge.ts`
- `src/hooks/native.ts`
- `packages/utils/src/create-logger.ts`
- `packages/utils/src/log-level.ts`
- `packages/core/src/env.ts`

关键事实：

- CLI init 和 hooks 不是从 adapter 内部直接创建 logger，而是走 CLI/core 入口
- Claude Code native hooks 的托管配置写在 `.ai/.mock/.claude/settings.json`
- 所以这类问题不要只盯着 adapter

### 5. server 控制台 / session jsonl 日志级别不对

先读：

- `apps/server/src/utils/logger.ts`
- `packages/utils/src/log-level.ts`
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
  - 继续看 `packages/utils/src/create-logger.ts`、`packages/utils/src/log-level.ts` 与 `src/claude/session.ts`
- 如果是 `adapter-claude-code/*.log.md`
  - 继续看 `src/ccr/config.ts` 与 `src/ccr/transformers/*.ts`
- 如果根本没有生成会话日志
  - 回到 CLI 入口与 `packages/task/src/prepare.ts`

## 经验约定

- 先确认问题属于哪一层：
  - CLI 入口
  - shared session logger
  - adapter runtime
  - CCR transformer
  - server pino

- 不要把 “主会话 debug 是否展示” 和 “transformer 是否写文件” 当成同一个开关。

- 修改日志策略后，至少回归：
  - `pnpm exec vitest run packages/utils/__tests__/create-logger.spec.ts packages/utils/__tests__/log-level.spec.ts packages/core/__tests__/env.spec.ts`
  - `pnpm exec vitest run packages/adapters/claude-code/__tests__/default-config.spec.ts`
  - `pnpm exec tsc -p tsconfig.json --noEmit`
