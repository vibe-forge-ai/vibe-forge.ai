# @vibe-forge/adapter-claude-code 0.8.1

发布日期：2026-03-31

## 发布范围

- 发布 `@vibe-forge/adapter-claude-code@0.8.1`

## 主要变更

- 当模型为 `serviceKey,modelName` 形式时，Claude Code 不再通过 `ccr code` 包装启动，而是复用 `.ai/.mock/.claude-code-router` 的后台 daemon
- Router 连接参数改为通过 session `--settings` 注入，普通原生 Claude 模型保持直连
- 调整 adapter 内部目录结构，按 `claude/`、`ccr/`、`hooks/` 三层拆分运行时、router 与 hook bridge 逻辑
- 升级 `@anthropic-ai/claude-code` 到 `2.1.87`，并将 `@musistudio/claude-code-router` 固定到 `1.0.73`

## 兼容性说明

- 包级导出 `./hook-bridge` 仍保持可用，但内部实现路径调整为 `src/hooks/bridge.ts`
- Router 运行方式从“每次通过 `ccr code` 启动”调整为“按需复用后台 daemon”，会依赖 `.ai/.mock/.claude-code-router` 下的配置与 pid 文件
