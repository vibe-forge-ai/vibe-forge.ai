# Hooks 真实 CLI 验证

返回入口：[HOOKS-REFERENCE.md](../HOOKS-REFERENCE.md)

## 通用原则

- 不要只依赖 `vitest`，至少让真实 CLI 完整经过一轮 hooks 链路。
- 每轮验证都固定 `ctxId` 和 `sessionId`，方便在 `.ai/logs/` 下定位。
- 验证时优先检查三件事：
  - 终端最终输出是否符合预期
  - `.ai/logs/<ctxId>/<sessionId>.log.md` 是否出现对应 hook 事件
  - `.ai/.mock` 下的托管配置是否仍指向 Vibe Forge hook bridge

## 标准入口

- `pnpm test:e2e:adapters`
- `pnpm tools adapter-e2e run codex`
- `pnpm tools adapter-e2e run claude-code`
- `pnpm tools adapter-e2e run opencode`
- `pnpm tools adapter-e2e run all`
- `pnpm tools adapter-e2e test codex-read-once --update`
- `pnpm tools adapter-e2e test codex-direct-answer --update`
- `pnpm tools adapter-e2e test all --update`

## 仓库内 smoke 命令

### Codex

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-codex' node apps/cli/cli.js --adapter codex --model hook-smoke-mock,codex-hooks --print --no-inject-default-system-prompt --exclude-mcp-server ChromeDevtools --session-id '<uuid>' "Use the Read tool exactly once on README.md, then reply with exactly E2E_CODEX and nothing else."
```

### Claude Code

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-claude' node apps/cli/cli.js --adapter claude-code --model 'hook-smoke-mock-ccr,claude-hooks' --print --no-inject-default-system-prompt --exclude-mcp-server ChromeDevtools --include-tool Read --permission-mode bypassPermissions --session-id '<uuid>' "Use the Read tool exactly once on README.md, then reply with exactly E2E_CLAUDE and nothing else."
```

### OpenCode

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-opencode' node apps/cli/cli.js --adapter opencode --model hook-smoke-mock,opencode-hooks --print --no-inject-default-system-prompt --exclude-mcp-server ChromeDevtools --session-id '<uuid>' "Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else."
```
