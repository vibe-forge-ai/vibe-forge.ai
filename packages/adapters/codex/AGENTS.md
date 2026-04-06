# Codex Adapter

Vibe-forge adapter for [OpenAI Codex CLI](https://developers.openai.com/codex).

The adapter drives Codex in two modes:

- **`stream`** (default) — spawns `codex app-server` and communicates over JSON-RPC 2.0 / JSONL.
- **`direct`** — spawns the interactive `codex` (or `codex resume`) CLI with `stdio: 'inherit'`, handing the terminal directly to the user.

---

## Official documentation

| Topic         | URL                                                  |
| ------------- | ---------------------------------------------------- |
| CLI reference | https://developers.openai.com/codex/cli/reference.md |
| Hooks         | https://developers.openai.com/codex/hooks            |
| Config basics | https://developers.openai.com/codex/config-basic     |
| Sample config | https://developers.openai.com/codex/config-sample    |
| MCP servers   | https://developers.openai.com/codex/mcp              |

---

## Hooks maintenance

Cross-reference these docs first when touching hooks:

- `.ai/rules/HOOKS.md` — user-facing behavior, event matrix, `.ai/.mock` asset layout
- `.ai/rules/HOOKS-REFERENCE.md` — real CLI smoke commands, lessons learned, shared runtime entrypoints
- `apps/cli/src/AGENTS.md` — CLI hook bridge entry and `call-hook.js` routing

Primary implementation entrypoints for Codex hooks:

- `src/runtime/native-hooks.ts`
  - writes the managed `.ai/.mock/.codex/hooks.json`
- `src/runtime/init.ts`
  - installs mock-home assets during adapter init
- `src/runtime/session-common.ts`
  - enables `codex_hooks`, injects runtime config, model/provider settings, and session env
- `src/hook-bridge.ts`
  - translates Codex native payloads into Vibe Forge hook input/output
- `packages/hooks/call-hook.js`
- `packages/hooks/src/entry.ts`
- `packages/hooks/src/native.ts`
- `packages/hooks/src/bridge.ts`
- `packages/task/src/run.ts`

Keep the ownership split clean:

- adapter layer: writes Codex-native config, passes runtime env, and owns Codex protocol translation
- CLI bridge: only dispatches into the adapter-owned bridge/runtime entry
- hooks runtime: loads workspace plugins; task runtime applies native/bridge dedupe

### Real CLI smoke

Do not stop at unit tests. Run a real Codex CLI turn:

Quick path from repo root:

```bash
pnpm test:e2e:adapters
pnpm tools adapter-e2e run codex
pnpm tools adapter-e2e test codex-read-once --update
```

This command starts the local mock LLM server and drives Codex through the `hook-smoke-mock` model service defined in the repo-root `.ai.config.json`. The shared adapter E2E harness lives under `scripts/adapter-e2e/`, and the scripts CLI entry is `scripts/cli.ts`.
The case definition, spec, and expected snapshot live together under `scripts/__tests__/adapter-e2e/`.

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

Validation checklist:

- terminal output is exactly `E2E_CODEX`
- `.ai/logs/<ctxId>/<sessionId>.log.md` contains `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`
- `.ai/.mock/.codex/hooks.json` still points to the managed Vibe Forge bridge

Codex maintenance notes:

- native hooks should stay entirely inside mock home; do not write to the real Codex home
- Codex 2026-03-27 official hooks docs say `~/.codex/hooks.json` and `<repo>/.codex/hooks.json` are both loaded, so project-level managed hooks must be deduped before writing mock-home hooks
- `SessionEnd` is still framework-owned and should not be reintroduced in Codex-native config
- when native hooks are active, bridge duplicates must stay disabled in `packages/task/src/run.ts`
- Codex native `PreToolUse` / `PostToolUse` should be treated as Bash-first until official coverage expands; transcript JSONL can supplement non-Bash analytics, but it cannot block or rewrite the live session

---

## Adapter configuration

Adapter-specific options live under `adapters.codex` in your vibe-forge config.

```ts
// .ai.config.ts / .ai.dev.config.ts
import { defineConfig } from '@vibe-forge/config'

export default defineConfig({
  adapters: {
    codex: {
      sandboxPolicy: { type: 'workspaceWrite' },
      experimentalApi: false,
      effort: 'medium',
      maxOutputTokens: 4096,
      clientInfo: { name: 'vibe-forge', title: 'Vibe Forge', version: '0.1.0' },
      features: {
        shell_snapshot: true,
        unified_exec: false
      }
    }
  }
})
```

### `sandboxPolicy`

Maps to the codex `sandbox_mode` / `--sandbox` CLI flag.

| vibe-forge type            | codex value          |
| -------------------------- | -------------------- |
| `workspaceWrite` (default) | `workspace-write`    |
| `readOnly`                 | `read-only`          |
| `dangerFullAccess`         | `danger-full-access` |

Optional fields on the sandbox policy object:

```ts
const sandboxPolicy = {
  type: 'workspaceWrite',
  writableRoots: ['/tmp/extra'], // extra writable roots
  networkAccess: true // allow outbound network inside sandbox
}
```

### `features`

Maps to `--enable <name>` / `--disable <name>` flags.\
Keys must be valid codex feature names (run `codex features list` to see all).

Notable flags:

| Name                 | Default | Description                                                              |
| -------------------- | ------- | ------------------------------------------------------------------------ |
| `shell_snapshot`     | false   | Snapshot shell environment for faster repeated commands                  |
| `unified_exec`       | false   | Use PTY-backed exec tool                                                 |
| `shell_tool`         | true    | Enable default shell tool                                                |
| `undo`               | true    | Per-turn git ghost snapshots                                             |
| `web_search_request` | true    | Live web search                                                          |
| `remote_models`      | false   | Refresh remote model list at startup                                     |
| `codex_hooks`        | false   | Native `SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/Stop` hooks |

### Native hooks

When workspace hook plugins are configured, the adapter now installs a managed `hooks.json`
into the isolated mock Codex home and auto-enables the `codex_hooks` feature flag for that
session. This lets Codex run native:

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `Stop`

Those native events are bridged back into the same Vibe Forge hook runtime used by Claude Code
and OpenCode. `SessionEnd` still comes from the framework bridge.

Codex limitation:

- today the reliable native `PreToolUse` / `PostToolUse` control surface is still `Bash`
- if we add transcript JSONL watching for non-Bash tools, treat it as a stats-only side channel
- JSONL observation does not carry hook return semantics, so it must not be documented or implemented as a blocking substitute for native hooks

### `effort`

Reasoning effort for supported models: `'low' | 'medium' | 'high'`.\
Passed to `turn/start` RPC calls in `stream` mode.

### `maxOutputTokens`

Maximum completion tokens per turn in `stream` mode.\
Passed to `turn/start` as `maxOutputTokens`.

### `experimentalApi`

Passed as `capabilities.experimentalApi` during the `initialize` handshake in `stream` mode.\
Enable this to expose gated app-server fields and methods.

---

## Model selection

Model is set via `AdapterQueryOptions.model` (not in adapter config).

### Plain model name

```
model: "gpt-5.4"
```

Passed directly as `--model gpt-5.4` (direct) or `model: "gpt-5.4"` in RPC calls (stream).

### Model service routing — `"service,model"` format

When the model string contains a comma, the adapter resolves it against `modelServices` and injects the provider configuration via `-c` overrides. Routed services are sent through a per-process local proxy so vibe-forge can translate service-level settings that Codex does not expose natively.

```
model: "myProvider,gpt-4o-mini"
```

This emits (in order):

```sh
-c 'model_provider="myProvider"'
-c 'model_providers.myProvider.name="My Provider"'
-c 'model_providers.myProvider.base_url="http://127.0.0.1:<random-port>"'
-c 'model_providers.myProvider.experimental_bearer_token="sk-..."'
-c 'model_providers.myProvider.wire_api="responses"'
-c 'model_providers.myProvider.http_headers={X-Vibe-Forge-Proxy-Meta = "<base64url-json>"}'
```

`wire_api` defaults to `"responses"`. Override per service via `service.extra.codex.wireApi`.
Static provider headers, query params, upstream base URL, and `maxOutputTokens` are encoded into the proxy metadata header and restored by the local proxy before the request is forwarded upstream.

The local proxy is started automatically by the adapter. Users do not need to run it manually. The proxy listens on a random loopback port and is reused across repeated routed Codex sessions in the same process.

`modelServices.<service>.maxOutputTokens` does not rely on a native Codex provider field. Instead, the adapter encodes it into the proxy metadata, and the proxy writes it into the outgoing Responses API JSON body as `max_output_tokens` when the upstream request does not already define that field.

Corresponding vibe-forge config:

```ts
const modelServices = {
  myProvider: {
    apiBaseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-...',
    title: 'My Provider',
    extra: {
      codex: {
        wireApi: 'responses',
        headers: { 'X-Tenant': 'tenant-1' },
        queryParams: { 'api-version': '2025-04-01-preview' }
      }
    }
  }
}
```

> `experimental_bearer_token` is a dev-only per-provider API key field in codex config.
> See the [sample config](https://developers.openai.com/codex/config-sample) under `[model_providers]`.

### Proxy logs

When routed model services use the local proxy, adapter-specific proxy logs are written to:

```text
.ai/logs/<ctxId>/<sessionId>/adapter-codex/proxy.log.md
```

This mirrors the adapter-scoped logging layout used by the Claude Code Router transformers. Proxy logs are separate from the main task/session log file and include structured request/response diagnostics without dumping sensitive query parameter values or credentials.

Each proxied request now logs:

- the full incoming request headers/body that Codex sent to the local proxy
- the final upstream URL, headers, and body after vibe-forge mutations such as `max_output_tokens` injection
- adapter-side routing context encoded in proxy metadata, including routed service, requested/resolved model, runtime, permission policy, and effort
- response headers plus full non-stream error bodies when the upstream provider returns a failure status

---

## Permission / approval policy

Set via `AdapterQueryOptions.permissionMode`. Mapped to codex values:

| vibe-forge `permissionMode`        | codex mapping                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `bypassPermissions`                | `--dangerously-bypass-approvals-and-sandbox` (`--yolo`) + `danger-full-access` |
| `dontAsk`                          | `approval_policy = never` / `--ask-for-approval never`                         |
| `plan`                             | `approval_policy = on-request` / `--ask-for-approval on-request`               |
| `default`, `acceptEdits`, or unset | `approval_policy = untrusted` / `--ask-for-approval untrusted`                 |

---

## System prompt

`AdapterQueryOptions.systemPrompt` is injected via:

```sh
-c 'developer_instructions="<prompt>"'
```

Maps to [`developer_instructions`](https://developers.openai.com/codex/config-sample) in `config.toml`.

---

## MCP servers

MCP server configuration is read from `config.mcpServers` and `userConfig.mcpServers`, merged in that order. Servers with `enabled: false` are filtered out. Include/exclude rules from `options.mcpServers` (or `defaultIncludeMcpServers` / `defaultExcludeMcpServers` in config) are applied before injection.

Each surviving server is injected as `-c mcp_servers.<name>.*` overrides.

### STDIO transport

Detected by the presence of a `command` key.

```toml
# config.toml equivalent
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
env = { API_KEY = "value" }
```

Emitted as:

```sh
-c 'mcp_servers.context7.command="npx"'
-c 'mcp_servers.context7.args=["-y","@upstash/context7-mcp"]'
-c 'mcp_servers.context7.env={API_KEY = "value"}'
```

### Streamable HTTP transport

Detected by the presence of a `url` key (`type: 'sse' | 'http'` in vibe-forge config).\
vibe-forge `headers` maps to codex `http_headers`.

```toml
# config.toml equivalent
[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
http_headers = { "X-Figma-Region" = "us-east-1" }
```

Emitted as:

```sh
-c 'mcp_servers.figma.url="https://mcp.figma.com/mcp"'
-c 'mcp_servers.figma.http_headers={"X-Figma-Region" = "us-east-1"}'
```

> See the [MCP docs](https://developers.openai.com/codex/mcp) for the full list of supported fields
> (`startup_timeout_sec`, `tool_timeout_sec`, `enabled_tools`, `disabled_tools`, `bearer_token_env_var`, etc.).
> Fields beyond `command`/`args`/`env`/`url`/`headers` must be set in `~/.codex/config.toml` directly,
> as the adapter only injects the fields required to register the server.

---

## Modes

### `stream` mode (default)

```
codex app-server [-c ...overrides] [--enable/--disable ...]
```

- Full JSON-RPC 2.0 lifecycle: `initialize` → `thread/start` (or `thread/resume`) → `turn/start`
- Supports mid-turn `turn/steer` and `turn/interrupt` via `emit()`
- Session thread IDs are cached in `adapter.codex.threads` for future resume

### `direct` mode

```
codex [-c ...overrides] [--model ...] [--sandbox ...] [--ask-for-approval ...] [--enable/--disable ...] [prompt?]
```

- `stdio: 'inherit'` — the terminal is given directly to the user
- `emit()` is a no-op in this mode
- `extraOptions` are appended before the prompt positional argument

#### Resume in `direct` mode

When `options.type === 'resume'`, the adapter looks up the cached codex thread ID and calls:

```
codex resume [--model ...] [--sandbox ...] [...] <threadId | --last> [prompt?]
```

If no cached thread ID is found it falls back to `--last` (most recent session in cwd).

---

## CLI reference highlights

The full reference is at https://developers.openai.com/codex/cli/reference.md.\
Key flags used by this adapter:

| Flag                   | Description                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `-c key=value`         | Override any config.toml key for this invocation. Values parse as JSON if possible, otherwise as a literal string. |
| `--model`              | Override the active model.                                                                                         |
| `--sandbox`            | `read-only \| workspace-write \| danger-full-access`                                                               |
| `--ask-for-approval`   | `untrusted \| on-request \| never`                                                                                 |
| `--enable / --disable` | Toggle feature flags for this run.                                                                                 |
| `--mcp-config`         | **(app-server only)** Path to a JSON MCP config file — not used by this adapter; MCP is injected via `-c`.         |

### Configuration precedence (codex)

1. CLI flags and `-c` overrides ← **this adapter operates here**
2. Profile values (`--profile`)
3. Project `.codex/config.toml`
4. User `~/.codex/config.toml`
5. System `/etc/codex/config.toml`
6. Built-in defaults
