# CLI Src 目录说明

CLI 侧只负责命令入口、参数归并、hook/plugin 调用与把任务交给 core / adapter。

## 什么时候先读这里

- 用户问题是通过 `npx vf ...` 复现出来的
- 想知道某个命令最终调用了哪个 adapter / runtime
- `init`、`run --print`、hook/plugin logger 的行为不符合预期
- 想确认环境变量是从 CLI 哪一层注入进去的

优先入口：
- `commands/run.ts`
- `commands/init.ts`
- `hooks/index.ts`

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
