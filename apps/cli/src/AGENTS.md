# CLI Src 目录说明

CLI 侧只负责命令入口、参数归并、hook/plugin 调用与把任务交给 app-facing runtime / adapter。
app-facing 的 task / benchmark 入口位于 `@vibe-forge/app-runtime`。
MCP stdio server 入口位于 `@vibe-forge/mcp`。
默认内建 `vibe-forge` MCP 的解析位于 `@vibe-forge/config`，由 task runtime 在 prepare 阶段注入；发布态的 `@vibe-forge/mcp` 安装锚点由 `@vibe-forge/app-runtime` 提供。
adapter 契约与 loader 位于 `@vibe-forge/types`。
task-facing workspace asset helper 位于 `@vibe-forge/workspace-assets`。
definition loader 位于 `@vibe-forge/definition-loader`。
通用 hooks runtime、`vf-call-hook` 与 native helper 位于 `@vibe-forge/hooks`。
`defineConfig()`、通用配置加载、默认 system prompt 策略和默认内建 MCP 解析位于 `@vibe-forge/config`，共享 logger / log-level / key-transform / system helper / model-selection / cache 位于 `@vibe-forge/utils`。
config、cache、definition、workspace asset 共享 contract 位于 `@vibe-forge/types`。

## 什么时候先读这里

- 用户问题是通过 `npx vf ...` 复现出来的
- 想知道某个命令最终调用了哪个 adapter / runtime
- `init`、`run --print`、hook/plugin logger 的行为不符合预期
- 想确认环境变量是从 CLI 哪一层注入进去的

文档交叉入口：

- `.ai/rules/HOOKS.md`
- `.ai/rules/HOOKS-REFERENCE.md`
- `packages/types/AGENTS.md`
- `packages/app-runtime/AGENTS.md`
- `packages/workspace-assets/AGENTS.md`
- `packages/mcp/AGENTS.md`
- `packages/task/AGENTS.md`
- `packages/adapters/codex/AGENTS.md`
- `packages/adapters/claude-code/AGENTS.md`
- `packages/adapters/opencode/AGENTS.md`

优先入口：

- `commands/run.ts`
- `hooks/index.ts`
- `../../packages/cli-helper/loader.js`
- `../../packages/hooks/call-hook.js`

## Hooks bridge 入口

hooks 相关问题先按这条链路看：

- `packages/hooks/call-hook.js`
  - 通用 hook 进程入口
  - 负责把 `HOME` 指到工作区 `.ai/.mock`，再执行 hooks runtime
- `apps/cli/src/hooks/index.ts`
  - 动态发现已安装 adapter 的 `./hook-bridge`，命中 active env 后执行，否则回退默认 `runHookCli()`
- `packages/hooks/src/runtime.ts`
  - 默认 hook runtime，负责读取输入、装载插件、执行 middleware
- `packages/config/src/load.ts`
  - hooks runtime 的配置读取、变量替换与缓存
- `packages/utils/src/create-logger.ts`
  - hooks runtime 与主会话共用的 markdown logger
- `packages/utils/src/string-transform.ts`
  - hook 输入 key 转换
- `packages/adapters/claude-code/src/hook-bridge.ts`
  - Claude native payload -> 统一 hook input/output
- `packages/adapters/codex/src/hook-bridge.ts`
  - Codex native payload -> 统一 hook input/output

维护约定：

- CLI 只做入口分发和最小 env 补齐，不承载 adapter 私有协议翻译
- 业务 hook 执行放在 `packages/hooks/src/*`
- 通用 `call-hook.js` 运行时与 `vf-call-hook` bin 都归 `packages/hooks`
- `.ai/.mock` 的 native 资产写入放在 adapter / `packages/hooks/src/native.ts`，不要散落到 CLI 命令层
- 真实 adapter E2E 验证优先走仓库根的 `pnpm test:e2e:adapters`
- 定向排查时走 `pnpm tools adapter-e2e run <selection>`
- `pnpm test:e2e:adapters` 和 `pnpm tools adapter-e2e run <selection>` 默认都会起本地 mock LLM server；对应模型服务配置在仓库根 `.ai.config.json`
  - `hook-smoke-mock` 给 Codex / OpenCode
  - `hook-smoke-mock-ccr` 给 Claude Code Router
- adapter E2E 的 shared harness 在 `scripts/adapter-e2e/`，scripts CLI 入口在 `scripts/cli.ts`
- 新增场景优先改 `scripts/__tests__/adapter-e2e/cases.ts` 和 `mock-llm/rules.ts`，不要再往脚本入口堆逻辑
- 真实 CLI 结果统一写进 Vitest file snapshot；更新时用 `pnpm tools adapter-e2e test <case-id> --update`

## 什么时候继续往下读别的目录

### 1. 看到的是命令入口问题

继续留在本目录：

- `commands/*.ts`
- `hooks/*.ts`

适合排查：

- 参数没有传下去
- `sessionId` / `ctxId` 生成不对
- `--print` / `--resume` / `--spec` / `--entity` / `--no-default-vibe-forge-mcp-server` 行为异常

### 2. 看到的是主会话日志级别问题

转到：

- `packages/task/src/prepare.ts`
- `packages/utils/src/create-logger.ts`
- `packages/utils/src/log-level.ts`
- `packages/core/src/env.ts`

原因：

- CLI 只是把环境变量和 runtime 带入 task
- 真正决定主会话 markdown 日志怎么写的是 `packages/utils` 加 `task prepare`

### 3. 看到的是 Claude Code adapter / CCR / transformer 问题

转到：

- `packages/adapters/claude-code/AGENTS.md`

进入条件：

- `Claude Code CLI stdout` 日志内容不对
- CCR transformer 日志文件缺失或异常
- create/resume 流程不对
- adapter CLI 参数、settings、mcp config 需要追踪

### 4. 看到的是独立 MCP server 问题

转到：

- `packages/mcp/AGENTS.md`
- `packages/mcp/src/cli.ts`
- `packages/mcp/src/command.ts`
- `packages/mcp/src/tools/task/manager.ts`

进入条件：

- `vf-mcp` 无法启动
- MCP tools 注册/过滤不对
- `StartTasks` 或 `AskUserQuestion` 结果异常

### 5. 看到的是 server 控制台 / session jsonl 问题

转到：

- `apps/server/src/utils/logger.ts`
- `apps/server/src/AGENTS.md`

## CLI 调试建议

- 复现前先执行 `npx vf clear`
- 独立 MCP server 冒烟先执行 `npx vf-mcp --help`
- 如果只想看本次日志，先 `touch /tmp/<marker>` 再执行命令
- `run --print` 的最终 session 行为由 task + adapter 决定，CLI 只负责入口编排，不要在 CLI 里追完整生命周期
- CLI loader 共享实现位置：`packages/cli-helper/loader.js`
- 适配器错误 / `stream-json` 冒烟流程见：`agents/adapter-error-debugging.md`
