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
- `pnpm tools adapter-e2e run gemini`
- `pnpm tools adapter-e2e run opencode`
- `pnpm tools adapter-e2e run all`
- `pnpm tools adapter-e2e test codex-read-once --update`
- `pnpm tools adapter-e2e test codex-apply-patch-once --update`
- `pnpm tools adapter-e2e test codex-transcript-mcp-bridge --update`
- `pnpm tools adapter-e2e test codex-transcript-file-change-bridge --update`
- `pnpm tools adapter-e2e test codex-direct-answer --update`
- `pnpm tools adapter-e2e test all --update`

## Codex 补链路验证

- `codex-apply-patch-once`：验证 `custom_tool_call` / `custom_tool_call_output` 能补出观测型 `PreToolUse` / `PostToolUse`。
- `codex-transcript-mcp-bridge`：验证 transcript 注入的 `mcp_tool_call` / `mcp_tool_call_output` 能进入统一 hook 日志。
- `codex-transcript-file-change-bridge`：验证 transcript 注入的 `file_change` 事件能进入统一 hook 日志。
- 上面两条 transcript 注入 case 只用于验证 bridge 统计链路，不代表这些事件具备 native hook 的阻断语义。

## 仓库内 smoke 命令

### Codex

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-codex' node apps/cli/cli.js --adapter codex --model hook-smoke-mock,codex-hooks --print --no-inject-default-system-prompt --exclude-mcp-server ChromeDevtools --session-id '<uuid>' "Use the Read tool exactly once on README.md, then reply with exactly E2E_CODEX and nothing else."
```

### Claude Code

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-claude' node apps/cli/cli.js --adapter claude-code --model 'hook-smoke-mock-ccr,claude-hooks' --print --no-inject-default-system-prompt --exclude-mcp-server ChromeDevtools --include-tool Read --permission-mode bypassPermissions --session-id '<uuid>' "Use the Read tool exactly once on README.md, then reply with exactly E2E_CLAUDE and nothing else."
```

### Gemini

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-gemini' node apps/cli/cli.js run --adapter gemini --model kimi,kimi-k2.5 --print --permission-mode bypassPermissions --no-inject-default-system-prompt --exclude-mcp-server ChromeDevtools --session-id '<uuid>' "Use the Read tool exactly once on README.md, then reply with exactly E2E_GEMINI and nothing else."
```

### OpenCode

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-opencode' node apps/cli/cli.js --adapter opencode --model hook-smoke-mock,opencode-hooks --print --no-inject-default-system-prompt --exclude-mcp-server ChromeDevtools --session-id '<uuid>' "Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else."
```
