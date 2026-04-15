# Kimi Verification

## 真实 CLI Smoke

不要只跑单测。至少覆盖一次本地真实 CLI：

```bash
PATH="$HOME/.local/bin:$PATH" \
npx vf --adapter kimi --print hi
```

如果要走真实 model service，使用仓库已有私有 [.ai.dev.config.json](../../../../../.ai.dev.config.json)，不要把 key 写进文档或提交：

```bash
PATH="$HOME/.local/bin:$PATH" \
__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER=/path/to/real/workspace \
npx vf \
  --adapter kimi \
  --model kimi,kimi-k2.5 \
  --exclude-mcp-server ChromeDevtools \
  --print hi
```

当前已验证的真实环境：

- `uv 0.11.6`
- Kimi CLI `1.35.0`
- `npx vf --adapter kimi --model kimi,kimi-k2.5 --print hi` 能通过真实 API 返回 Kimi 响应

## 本地检查

```bash
pnpm exec dprint check
pnpm exec eslint .
pnpm typecheck
pnpm exec vitest run \
  packages/adapters/kimi/__tests__/runtime-config.spec.ts \
  packages/adapters/kimi/__tests__/native-hooks.spec.ts \
  packages/workspace-assets/__tests__/adapter-asset-plan.spec.ts \
  packages/task/__tests__/run.spec.ts \
  packages/hooks/__tests__/runtime.spec.ts \
  apps/server/__tests__/services/session-permission.spec.ts
```

## 官方资料

- [Kimi Code CLI Docs](https://moonshotai.github.io/kimi-cli/en/)
- [kimi Command](https://moonshotai.github.io/kimi-cli/en/reference/kimi-command.html)
- [Print 模式](https://moonshotai.github.io/kimi-cli/zh/customization/print-mode.html)
- [Config Files](https://moonshotai.github.io/kimi-cli/en/configuration/config-files.html)
- [Providers and Models](https://moonshotai.github.io/kimi-cli/en/configuration/providers.html)
- [Hooks Beta](https://moonshotai.github.io/kimi-cli/zh/customization/hooks.html)
- [KIMI Brand Guidelines](https://moonshotai.github.io/Branding-Guide/)
- [MoonshotAI/kimi-cli issues](https://github.com/MoonshotAI/kimi-cli/issues)
