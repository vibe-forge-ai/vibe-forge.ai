# CLI Src 目录说明

CLI 侧只负责命令入口、参数归并、hook/plugin 调用与把任务交给 core / adapter。

## 什么时候先读这里

- 用户问题是通过 `npx vf ...` 复现出来的
- 想知道某个命令最终调用了哪个 adapter / runtime
- `init`、`run --print`、hook/plugin logger 的行为不符合预期
- 想确认环境变量是从 CLI 哪一层注入进去的

文档交叉入口：

- `docs/HOOKS.md`
- `docs/HOOKS-REFERENCE.md`
- `packages/adapters/codex/AGENTS.md`
- `packages/adapters/claude-code/AGENTS.md`
- `packages/adapters/opencode/AGENTS.md`

优先入口：

- `commands/run.ts`
- `commands/init.ts`
- `hooks/index.ts`
- `hooks/claude.ts`
- `hooks/codex.ts`
- `../call-hook.js`
- `../claude-hook.js`
- `../codex-hook.js`

## Hooks bridge 入口

hooks 相关问题先按这条链路看：

- `apps/cli/call-hook.js`
  - 把 `HOME` 指到工作区 `.ai/.mock`
  - 统一走 `./src/hooks`
- `apps/cli/src/hooks/index.ts`
  - 进入 core 的 `runHookCli()`
- `apps/cli/claude-hook.js` / `apps/cli/src/hooks/claude.ts`
  - Claude native payload -> 统一 hook input/output
- `apps/cli/codex-hook.js` / `apps/cli/src/hooks/codex.ts`
  - Codex native payload -> 统一 hook input/output

维护约定：

- CLI bridge 只做协议翻译和最小 env 补齐，不写业务判断
- 业务 hook 执行放在 `packages/core/src/hooks/*`
- `.ai/.mock` 的 native 资产写入放在 adapter / core native helper，不要散落到 CLI 命令层
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
- `--print` / `--resume` / `--spec` / `--entity` 行为异常

### 2. 看到的是主会话日志级别问题

转到：

- `packages/core/src/controllers/task/prepare.ts`
- `packages/core/src/utils/create-logger.ts`
- `packages/core/src/env.ts`

原因：

- CLI 只是把环境变量和 runtime 带入 core
- 真正决定主会话 markdown 日志怎么写的是 core

### 3. 看到的是 Claude Code adapter / CCR / transformer 问题

转到：

- `packages/adapters/claude-code/AGENTS.md`

进入条件：

- `Claude Code CLI stdout` 日志内容不对
- CCR transformer 日志文件缺失或异常
- create/resume 流程不对
- adapter CLI 参数、settings、mcp config 需要追踪

### 4. 看到的是 server 控制台 / session jsonl 问题

转到：

- `apps/server/src/utils/logger.ts`
- `apps/server/src/AGENTS.md`

## CLI 调试建议

- 复现前先执行 `npx vf clear`
- 如果只想看本次日志，先 `touch /tmp/<marker>` 再执行命令
- `run --print` 的最终 session 行为由 core + adapter 决定，CLI 只负责入口编排，不要在 CLI 里追完整生命周期
- 适配器错误 / `stream-json` 冒烟流程见：`agents/adapter-error-debugging.md`
