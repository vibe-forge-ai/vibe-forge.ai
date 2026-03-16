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
| Config basics | https://developers.openai.com/codex/config-basic     |
| Sample config | https://developers.openai.com/codex/config-sample    |
| MCP servers   | https://developers.openai.com/codex/mcp              |

---

## Adapter configuration

Adapter-specific options live under `adapters.codex` in your vibe-forge config.

```ts
// .ai.config.ts / .ai.dev.config.ts
import { defineConfig } from '@vibe-forge/core'

export default defineConfig({
  adapters: {
    codex: {
      sandboxPolicy: { type: 'workspaceWrite' },
      experimentalApi: false,
      effort: 'medium',
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
sandboxPolicy: {
  type: 'workspaceWrite',
  writableRoots: ['/tmp/extra'],   // extra writable roots
  networkAccess: true,             // allow outbound network inside sandbox
}
```

### `features`

Maps to `--enable <name>` / `--disable <name>` flags.\
Keys must be valid codex feature names (run `codex features list` to see all).

Notable flags:

| Name                 | Default | Description                                             |
| -------------------- | ------- | ------------------------------------------------------- |
| `shell_snapshot`     | false   | Snapshot shell environment for faster repeated commands |
| `unified_exec`       | false   | Use PTY-backed exec tool                                |
| `shell_tool`         | true    | Enable default shell tool                               |
| `undo`               | true    | Per-turn git ghost snapshots                            |
| `web_search_request` | true    | Live web search                                         |
| `remote_models`      | false   | Refresh remote model list at startup                    |

### `effort`

Reasoning effort for supported models: `'low' | 'medium' | 'high'`.\
Passed to `turn/start` RPC calls in `stream` mode.

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

When the model string contains a comma, the adapter resolves it against `modelServices` and injects the provider configuration via `-c` overrides:

```
model: "myProvider,gpt-4o-mini"
```

This emits (in order):

```sh
-c 'model_provider="myProvider"'
-c 'model_providers.myProvider.name="My Provider"'
-c 'model_providers.myProvider.base_url="https://api.example.com/v1"'
-c 'model_providers.myProvider.experimental_bearer_token="sk-..."'
-c 'model_providers.myProvider.wire_api="responses"'
```

`wire_api` defaults to `"responses"`. Override per service via `service.extra.codex.wireApi`.

Corresponding vibe-forge config:

```ts
modelServices: {
  myProvider: {
    apiBaseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-...',
    title: 'My Provider',
    extra: {
      codex: { wireApi: 'responses' },
    },
  },
},
```

> `experimental_bearer_token` is a dev-only per-provider API key field in codex config.
> See the [sample config](https://developers.openai.com/codex/config-sample) under `[model_providers]`.

---

## Permission / approval policy

Set via `AdapterQueryOptions.permissionMode`. Mapped to codex values:

| vibe-forge `permissionMode`        | codex `approval_policy` / `--ask-for-approval` |
| ---------------------------------- | ---------------------------------------------- |
| `bypassPermissions` or `dontAsk`   | `never`                                        |
| `plan`                             | `on-request`                                   |
| `default`, `acceptEdits`, or unset | `untrusted`                                    |

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
