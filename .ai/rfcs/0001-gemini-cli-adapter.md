---
rfc: 0001
title: Gemini CLI Adapter Support
status: draft
authors:
  - Codex
created: 2026-04-15
updated: 2026-04-16
targetVersion: vNext
---

# RFC 0001: Gemini CLI Adapter Support

## Summary

Add first-class `gemini` adapter support by introducing a new
`@vibe-forge/adapter-gemini` package. The adapter should run Gemini CLI in
headless mode, parse `stream-json` events into the shared `AdapterOutputEvent`
contract, and participate in the existing config, model selection, workspace
asset, hook bridge, server session, and client display flows. The adapter also
needs a local compatibility gateway for `modelServices` that expose
OpenAI-compatible `chat/completions`, so Gemini CLI can target external models
such as Kimi without pretending Gemini has a native `apiHost` provider setting.

This RFC intentionally treats Gemini CLI as a native adapter rather than a UI
alias or shell wrapper. Gemini has its own session store, settings hierarchy,
MCP configuration, skills discovery, hooks, approval modes, and output protocol.
Those differences should be isolated inside the adapter package and the existing
adapter-facing extension points.

## Motivation

The repository already supports multiple agent CLIs through the adapter
contract. Adding Gemini CLI expands the available runtime choices while keeping
task execution, channel integration, permissions, workspace assets, and UI
behavior consistent for users.

Gemini CLI is a reasonable adapter candidate because the current stable npm
package, `@google/gemini-cli@0.38.0`, exposes:

- a `gemini` binary;
- headless execution with `-p/--prompt`;
- `--output-format stream-json`;
- `--resume/-r`;
- `--approval-mode default|auto_edit|yolo|plan`;
- `~/.gemini/settings.json` and workspace `.gemini/settings.json`;
- `mcpServers`, native hooks, and agent skills.

## Goals

- Add a loadable adapter key named `gemini`.
- Add an adapter package at `packages/adapters/gemini`.
- Support create and resume turns through Gemini CLI headless mode.
- Parse Gemini JSONL events into Vibe Forge messages, tool calls, errors, init
  events, and exit events.
- Preserve Gemini session IDs in Vibe Forge cache so follow-up turns can resume
  the native Gemini conversation.
- Project selected MCP servers into Gemini `mcpServers`.
- Project selected skills into Gemini native skill locations.
- Install a Gemini native hook bridge for the shared Vibe Forge hook runtime.
- Expose Gemini built-in models and frontend adapter display metadata.
- Support `modelServices.<service>` selectors that point to
  OpenAI-compatible `chat/completions` endpoints by routing Gemini CLI through a
  local Gemini-to-OpenAI compatibility gateway.
- Add focused unit coverage and adapter E2E smoke coverage.

## Non-Goals

- Do not implement Gemini ACP / IDE integration in the first pass.
- Do not enable or manage Gemini extensions / extension marketplace support by
  default.
- Do not make Gemini checkpoint restore part of Vibe Forge session branching in
  the first pass.
- Do not support OpenAI Responses API routing, legacy `/completions`, or
  arbitrary non-`chat/completions` external protocols in V1.
- Do not manage Gemini custom slash commands in V1.
- Do not map Gemini `BeforeModel`, `AfterModel`, or `BeforeToolSelection` into
  Vibe Forge hooks until the core adapter is stable.
- Do not replace Gemini's built-in system prompt by default.

## Background

The current adapter stack has a few important boundaries:

- `@vibe-forge/types` owns adapter contracts and adapter package resolution.
- `@vibe-forge/task` owns task lifecycle, effective model/effort resolution,
  adapter asset plan attachment, and native/managed hook bridge de-duplication.
- `@vibe-forge/workspace-assets` owns workspace asset bundle discovery and the
  adapter asset plan.
- Each adapter package owns its CLI invocation, native settings files, output
  parsing, native hook bridge, and adapter-specific config augmentation.
- `apps/client` imports adapter display metadata explicitly.
- Built-in permission hooks and permission-state mirrors currently use explicit
  adapter allow-lists for native tool hooks.

Gemini integration crosses all of those surfaces. Adding the package alone will
not be enough because `WorkspaceAssetAdapter`, task asset-plan support, native
skill support, native hook bridge de-duplication, built-in models, and frontend
display all currently contain explicit adapter lists. The current task runtime
also reuses the effort-supported adapter set as the asset-plan-supported adapter
set; Gemini must split those two concepts because it needs asset plans but does
not support Vibe Forge effort in V1.

## Proposed Design

### Adapter Package

Create:

```text
packages/adapters/gemini/
  package.json
  src/index.ts
  src/adapter-config.ts
  src/icon.ts
  src/models.ts
  src/paths.ts
  src/runtime/init.ts
  src/runtime/session.ts
  src/runtime/stream.ts
  src/runtime/settings.ts
  src/runtime/native-hooks.ts
  src/hook-bridge.ts
```

The package should export:

- `.` for the adapter default export;
- `./models` for built-in model metadata;
- `./icon` for client display;
- `./hook-bridge` for `@vibe-forge/hooks`;
- `./schema` only if Gemini-specific tool schemas are added later.

The first implementation may depend on `@google/gemini-cli` instead of requiring
users to install a global `gemini` binary. The dependency decision must be made
explicitly because the upstream package is large and includes optional native
dependencies such as keychain and pseudo-terminal bindings. The adapter should
still support a command override so users can test preview, nightly, or globally
installed binaries locally.

The current `@google/gemini-cli@0.38.0` package declares Node `>=20` and optional
dependencies for `keytar`, `node-pty`, and platform-specific `@lydell/node-pty`
packages. If the bundled dependency path is chosen, package integration must
verify pnpm's build-script policy and update `onlyBuiltDependencies`
deliberately, or document that optional native auth/PTY helpers may be skipped.

### Adapter Config

Extend `AdapterMap` with:

```ts
interface AdapterMap {
  gemini: {
    cliPath?: string
    command?: {
      bin: string
      args?: string[]
    }
    settings?: Record<string, unknown>
    systemPromptMode?: 'prompt-prelude' | 'system-md'
    homeMode?: 'mock' | 'real'
    disableExtensions?: boolean
    disableSubagents?: boolean
    disableAutoUpdate?: boolean
    telemetry?: 'off' | 'inherit'
    nativePromptCommands?: 'reject' | 'allow'
    env?: Record<string, string>
  }
}
```

Common adapter config fields such as `defaultModel`, `includeModels`, and
`excludeModels` continue to come from `AdapterConfigCommon`.

Default behavior:

- `cliPath`: resolved from the bundled `@google/gemini-cli` package if the
  package dependency path is chosen.
- `command`: optional override for package-manager wrappers or global binaries.
- `settings`: merged into generated Gemini settings after Vibe Forge managed
  fields, with Vibe Forge managed fields winning where needed for hooks/MCP.
- `systemPromptMode`: `prompt-prelude`.
- `homeMode`: `mock`.
- `disableExtensions`: true.
- `disableSubagents`: true.
- `disableAutoUpdate`: true.
- `telemetry`: `off`.
- `nativePromptCommands`: `reject`.
- `env`: adapter-scoped environment overrides for documented Gemini CLI
  variables that should not be placed in global `config.env`.

V1 should not add a Gemini-specific `apiHost`, `apiBaseUrl`, `baseUrl`, or
`provider` config field. The currently discovered endpoint-like knobs have
different meanings and stability levels, so exposing one as a normal provider
host would imply support that Gemini CLI does not document for headless adapter
turns. External providers should continue to be declared through shared
`modelServices`; the adapter can then translate supported services into a local
compatibility gateway automatically.

### External Model Services

Gemini CLI `0.38.0` can run in headless mode with `security.auth.selectedType:
"gateway"` plus `useExternal: true`, but its upstream protocol remains Gemini
`generateContent/streamGenerateContent`, not OpenAI `chat/completions`.
Therefore, supporting external providers in V1 requires a local compatibility
gateway owned by the adapter:

1. Resolve `service,model` selectors from shared `modelServices`.
2. Accept only OpenAI-compatible `chat/completions` upstream services in V1.
3. Start a local HTTP proxy that accepts Gemini `v1beta/models/*` requests from
   Gemini CLI.
4. Translate Gemini request content, tool declarations, function-call history,
   and tool-response history into OpenAI chat-completions payloads.
5. Translate upstream OpenAI responses back into Gemini SSE chunks so Gemini
   CLI can continue handling native automatic function calling.
6. Inject the proxy base URL through `GOOGLE_GEMINI_BASE_URL` and set Gemini
   settings auth to `gateway`/`useExternal`.

This keeps the user-facing configuration aligned with the rest of Vibe Forge:
users configure `modelServices.kimi` once, then select `kimi,kimi-k2.5` while
still using the `gemini` adapter.

### Execution Environment, HOME, and Authentication

Gemini uses user-level state under `~/.gemini` for settings, auth, session
history, policy, and related runtime files. Vibe Forge also uses a mock home for
other adapters so native settings and hooks can be managed without mutating the
real user home. Gemini also documents `GEMINI_CLI_HOME` as the root directory
for user-level configuration and storage. The adapter should prefer
`GEMINI_CLI_HOME=.ai/.mock` over changing `HOME`, because changing `HOME` affects
tools and child processes beyond Gemini's own config discovery.

V1 should use a hybrid mock-home strategy:

1. Spawn Gemini with `GEMINI_CLI_HOME=.ai/.mock` so Vibe Forge can manage
   `.ai/.mock/.gemini/settings.json` deterministically.
2. Preserve auth through environment-based credentials when available
   (`GEMINI_API_KEY`, `GOOGLE_API_KEY`, Vertex/Google Cloud env). This is the
   only V1 auth path that should be considered fully supported.
3. Treat real-home login reuse as optional and version-pinned, not as a generic
   symlink of `~/.gemini`. For `@google/gemini-cli@0.38.0`, non-interactive
   auth preflight chooses an auth type only from
   `security.auth.selectedType`/`security.auth.enforcedType` or
   `getAuthTypeFromEnv()`. Cached keychain/file credentials alone do not select
   an auth type.
4. Never mutate the real `~/.gemini/settings.json`, real policy files, or real
   skills directories from the adapter.
5. Set `__VF_PROJECT_REAL_HOME__` so hooks and diagnostics can explain whether
   data came from the real home or the managed mock home.
6. Do not write Gemini `trustedFolders.json` in V1. Source inspection of
   `@google/gemini-cli@0.38.0` shows `isWorkspaceTrusted()` returns trusted in
   headless mode, so the process-per-turn runtime should not need mock-home
   folder-trust mutation. The adapter should still have a smoke test that
   detects any future approval-mode downgrade in headless mode.

If auth cannot be discovered, the adapter should emit a clear fatal error with
setup guidance rather than launching Gemini and surfacing a lower-level upstream
authentication failure.

The auth-storage boundary is sharper than the initial investigation suggested:

- `GEMINI_CLI_HOME` changes Gemini's own `homedir()` helper, so settings,
  `oauth_creds.json`, `google_accounts.json`, `mcp-oauth-tokens.json`,
  `a2a-oauth-tokens.json`, and file-fallback credentials resolve under
  `.ai/.mock/.gemini`.
- Native OS keychain entries are not inside `GEMINI_CLI_HOME`. API-key storage
  uses service `gemini-cli-api-key`; OAuth storage can use service
  `gemini-cli-oauth`.
- If native keychain is unavailable or `GEMINI_FORCE_FILE_STORAGE=true`, the
  fallback encrypted store is `.gemini/gemini-credentials.json`, encrypted with
  host/user-derived key material. Copying this file between homes may not be
  portable and should not be a default migration path.
- With `GEMINI_FORCE_ENCRYPTED_FILE_STORAGE=true`, OAuth personal credentials use
  the keychain/encrypted-file path. Without it, OAuth personal still reads/writes
  `.gemini/oauth_creds.json` in this pinned version.
- Non-interactive `gemini-api-key` validation checks `GEMINI_API_KEY` in the
  process environment after `.env` loading. A Gemini API key saved only in
  Gemini's keychain is therefore not a dependable V1 headless auth source.
- Real-home OAuth reuse, if implemented, needs both verified credential storage
  and an explicit `security.auth.selectedType: "oauth-personal"` projection into
  the mock-home settings. It must not copy the whole real settings file.

Gemini also loads environment variables from the first matching env file while
walking from the workspace upward: `.gemini/.env`, then `.env`, and finally
`$GEMINI_CLI_HOME/.gemini/.env` or `$GEMINI_CLI_HOME/.env`. Values from these
files only fill variables that are not already present in `process.env`. The
adapter should therefore set managed env values before spawn and should not copy
the user's real `~/.gemini/.env` into the mock home by default. If env auth is
missing but a real-home `.gemini/.env` exists, diagnostics may mention the path
without reading or printing its contents.

### Settings Precedence

Gemini loads system defaults, user settings, workspace `.gemini/settings.json`,
and system override settings. Workspace settings override user settings, and
system override settings can override every lower layer. A managed user-level
settings file in the mock home can therefore be partially or fully overridden by
a repository settings file or by enterprise/system configuration.

The adapter must make precedence explicit:

- Read workspace `.gemini/settings.json` if it exists.
- Generate the managed mock-home `.ai/.mock/.gemini/settings.json`.
- Detect workspace fields that override managed `mcpServers`, `hooks`,
  `hooksConfig`, `tools.sandbox`, `admin.extensions.enabled`, or safety-related
  defaults.
- Detect workspace context expansion fields such as `context.includeDirectories`,
  `context.loadMemoryFromIncludeDirectories`, `experimental.jitContext`,
  `experimental.memoryManager`, and `experimental.enableAgents`.
- Detect permission-affecting fields such as `policyPaths`, `adminPolicyPaths`,
  `tools.allowed`, `tools.exclude`, `tools.core`, and `mcp.allowed`.
- Emit `assetDiagnostics` or adapter warnings when workspace settings shadow
  managed Vibe Forge entries.
- Do not rewrite the repository `.gemini/settings.json` unless a future RFC
  introduces an explicit managed workspace overlay.

Managed defaults should include:

- `general.enableAutoUpdate: false` unless the user explicitly opts in.
- `hooksConfig.enabled: true` when native hooks are installed.
- `admin.extensions.enabled: false` when `disableExtensions` is true. This is the
  default because Gemini CLI loads all installed extensions when the `--extensions`
  list is omitted.
- `experimental.enableAgents: false` when `disableSubagents` is true. This is the
  default because Gemini CLI enables local and remote subagents by default.
- `context.loadMemoryFromIncludeDirectories: false`; V1 should not add extra
  context roots through Gemini include directories.
- `telemetry` disabled by default; `inherit` is an explicit opt-in for
  environments that intentionally preserve Gemini telemetry settings.
- For default telemetry-off launches, set `telemetry.enabled: false`,
  `telemetry.logPrompts: false`, `privacy.usageStatisticsEnabled: false`,
  `GEMINI_TELEMETRY_ENABLED=false`, and `GEMINI_TELEMETRY_LOG_PROMPTS=false`.

### API, Endpoint, and Proxy Environment

Gemini CLI does not currently document a Codex/OpenCode-style general
OpenAI-compatible `apiBaseUrl` or provider host setting for normal headless
turns. It does expose several narrower environment/config surfaces that the
adapter should recognize and preserve:

| Surface                                         | Scope                                           | Adapter handling                                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                                | Gemini Developer API auth                       | Preserve/pass through; use for env-auth smoke tests.                                                                                   |
| `GEMINI_MODEL`                                  | Gemini default model env                        | Preserve, but always pass adapter-resolved `--model` so ambient env cannot override Vibe Forge model selection.                        |
| `GOOGLE_API_KEY`                                | Vertex AI express-mode auth                     | Preserve/pass through.                                                                                                                 |
| `GOOGLE_GENAI_USE_VERTEXAI`                     | Select Vertex AI auth path                      | Preserve/pass through when set.                                                                                                        |
| `GOOGLE_CLOUD_PROJECT`                          | Code Assist / Vertex AI project                 | Preserve/pass through when set.                                                                                                        |
| `GOOGLE_CLOUD_PROJECT_ID`                       | Fallback project id used by Gemini CLI          | Preserve/pass through when set.                                                                                                        |
| `GOOGLE_CLOUD_LOCATION`                         | Vertex AI location                              | Preserve/pass through when set.                                                                                                        |
| `GOOGLE_APPLICATION_CREDENTIALS`                | Service-account / external-account JSON         | Preserve/pass through, but do not treat it as sufficient without the matching auth selector env/settings.                              |
| `GOOGLE_GENAI_API_VERSION`                      | Gemini SDK API version override                 | Preserve/pass through when set; do not treat as a provider endpoint.                                                                   |
| `GOOGLE_GENAI_USE_GCA`                          | Google Code Assist / OAuth-personal env auth    | Preserve/pass through when set; do not synthesize.                                                                                     |
| `GOOGLE_CLOUD_ACCESS_TOKEN`                     | Access token used with GCA env auth             | Preserve/pass through when already set; redact in diagnostics/logs.                                                                    |
| `GEMINI_CLI_USE_COMPUTE_ADC`                    | Compute ADC auth path                           | Preserve/pass through when set.                                                                                                        |
| `NO_BROWSER`                                    | Suppress interactive OAuth browser launch       | Set to `true` for V1 headless launches so missing OAuth credentials fail fast instead of opening a browser.                            |
| `GEMINI_CLI_NO_RELAUNCH`                        | Disable Gemini's Node child-process relaunch    | Set to `true` for V1 so cancellation and exit-code handling target the real headless process.                                          |
| `GEMINI_SANDBOX`                                | Gemini full-process sandbox selector            | Reject for V1 unless a future pinned test proves sandbox relaunch keeps prompt content out of argv.                                    |
| `GEMINI_SYSTEM_MD`                              | Replace Gemini's built-in system prompt         | Do not set by default; reject ambient values unless `systemPromptMode: "system-md"` is explicitly selected.                            |
| `GEMINI_WRITE_SYSTEM_MD`                        | Write Gemini's built-in system prompt to disk   | Reject for V1 because it mutates workspace files outside a turn.                                                                       |
| `GEMINI_CLI_SYSTEM_SETTINGS_PATH`               | Highest-precedence system settings file         | Do not set from adapter config; if inherited from the environment, surface that system settings may override V1 managed settings.      |
| `GEMINI_CLI_SYSTEM_DEFAULTS_PATH`               | Lowest-precedence system defaults file          | Do not set from adapter config; preserve inherited enterprise defaults with diagnostics.                                               |
| `GEMINI_CLI_IDE_WORKSPACE_PATH`                 | Extra IDE workspace roots                       | Strip or reject for V1 so IDE integration cannot silently expand context and file access roots.                                        |
| `GEMINI_CLI_EXTENSION_REGISTRY_URI`             | Gemini extension registry source                | Reject or strip while extensions are disabled; preserve only for an explicit future extension opt-in mode.                             |
| `GEMINI_FORCE_FILE_STORAGE`                     | Disable native keychain and force file fallback | Preserve only if explicitly set; warn that mock-home isolation changes the fallback file location.                                     |
| `GEMINI_FORCE_ENCRYPTED_FILE_STORAGE`           | Use keychain/encrypted-file storage for OAuth   | Preserve only if explicitly set; cover OAuth/MCP storage behavior in pinned-version smoke tests.                                       |
| `CODE_ASSIST_ENDPOINT`                          | Code Assist server endpoint for dev/test        | Pass through only when explicitly configured by user/env; do not synthesize from `modelServices.apiBaseUrl`.                           |
| `CODE_ASSIST_API_VERSION`                       | Code Assist server API version                  | Pass through only when explicitly configured by user/env.                                                                              |
| `GOOGLE_GEMINI_BASE_URL`                        | GenAI SDK Gemini base URL override              | Managed by the adapter for routed `modelServices`; otherwise preserve only when explicitly set and do not expose as adapter `apiHost`. |
| `GOOGLE_VERTEX_BASE_URL`                        | GenAI SDK Vertex base URL override              | Preserve only when explicitly set; treat as experimental and undocumented for Gemini CLI headless support.                             |
| `GEMINI_CLI_CUSTOM_HEADERS`                     | Extra request headers parsed by Gemini CLI      | Preserve only when explicitly set; redact in logs.                                                                                     |
| `GEMINI_API_KEY_AUTH_MECHANISM`                 | API key header mode, such as bearer             | Preserve only when explicitly set.                                                                                                     |
| `GEMINI_CLI_SURFACE`                            | User-Agent/reporting label                      | Consider setting to a Vibe Forge-specific value or allow override.                                                                     |
| `GEMINI_TELEMETRY_*`                            | Gemini telemetry env overrides                  | Set disabled values by default; preserve only when `telemetry: "inherit"` is explicit.                                                 |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`       | Network proxy for CLI requests                  | Preserve from `ctx.env` unless adapter config intentionally overrides; document interaction with sandbox proxy.                        |
| `GEMINI_SANDBOX_PROXY_COMMAND`                  | Tool sandbox network proxy command              | Do not manage in V1; pass through only if user already set it.                                                                         |
| `experimental.gemmaModelRouter.classifier.host` | Local Gemma router endpoint in `settings.json`  | Allow via raw `adapters.gemini.settings`, but do not expose as Vibe Forge external model support.                                      |

The adapter should merge environment in this order:

1. base process environment from `ctx.env`;
2. Vibe Forge managed environment such as `GEMINI_CLI_HOME`, hook bridge vars,
   telemetry toggles, and auto-update controls;
3. explicit `adapters.gemini.env` overrides.

Managed values that protect isolation and lifecycle, such as `GEMINI_CLI_HOME`,
`NO_BROWSER`, `GEMINI_CLI_NO_RELAUNCH`, and native hook bridge env, should win
unless the RFC for a real-home or interactive-auth mode explicitly relaxes that
rule.

Auth selection should follow Gemini CLI rather than duplicate it:

- Do not synthesize `security.auth.selectedType` in generated settings when env
  auth can be inferred. Gemini CLI already derives auth from
  `GOOGLE_GENAI_USE_GCA`, `GOOGLE_GENAI_USE_VERTEXAI`, `GEMINI_API_KEY`,
  `CLOUD_SHELL`, and `GEMINI_CLI_USE_COMPUTE_ADC`.
- Do not assume cached credentials imply an auth type. In non-interactive mode,
  Gemini validates `configuredAuthType || getAuthTypeFromEnv()` before
  `refreshAuth()`, so stored OAuth/API-key artifacts are insufficient unless
  settings or env select the same auth path.
- Require `GEMINI_API_KEY` or a Gemini-loaded `.env` value for
  `gemini-api-key` V1 runs. A key saved in Gemini's keychain may be loaded later
  by `createContentGeneratorConfig()`, but the current non-interactive validator
  rejects `gemini-api-key` first if `process.env.GEMINI_API_KEY` is absent.
- Treat `GOOGLE_APPLICATION_CREDENTIALS` as credential material, not an auth
  selector. It still needs a compatible explicit selection such as
  `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_GENAI_USE_GCA=true`, or a preserved
  `security.auth.selectedType`.
- Preserve explicit user-provided `security.auth.selectedType`,
  `security.auth.enforcedType`, and `security.auth.useExternal` from raw
  `adapters.gemini.settings` or workspace settings.
- Validate explicit auth settings before process launch and emit a Vibe
  Forge-level diagnostic when they conflict with available credentials. For
  example, `selectedType: "vertex-ai"` without Vertex credentials should fail
  before a lower-level Gemini auth error.
- When Vibe Forge resolves a routed `service,model`, generate
  `security.auth.selectedType: "gateway"` plus `useExternal: true` in the
  managed Gemini settings and point `GOOGLE_GEMINI_BASE_URL` at the adapter's
  loopback compatibility proxy.
- Outside that managed routed-service path, treat user-supplied gateway/base-url
  behavior as experimental. V1 should not expose a separate Gemini adapter
  `apiHost` / `apiBaseUrl` field or advertise direct arbitrary endpoint routing.

The current Gemini CLI ACP path exposes an "AI API Gateway" auth method with
`baseUrl` and headers in an ACP authentication payload. That is not a documented
normal headless `gemini --output-format stream-json` provider config. V1 should
not rely on it for the adapter runtime.

Source inspection of `@google/gemini-cli@0.38.0` also shows:

- `getAuthTypeFromEnv()` prefers GCA, then Vertex AI, then `GEMINI_API_KEY`,
  then Cloud Shell / compute ADC.
- `security.auth.selectedType` can be `gemini-api-key`, `vertex-ai`,
  `oauth-personal`, `compute-default-credentials`, or `gateway`.
- `security.auth.selectedType` can be `gateway`, but the normal headless CLI
  path calls `refreshAuth(authType)` without an ACP `baseUrl` payload.
- Gemini's bundled GenAI SDK reads `GOOGLE_GEMINI_BASE_URL` and
  `GOOGLE_VERTEX_BASE_URL`.
- `GOOGLE_CLOUD_ACCESS_TOKEN` can be used with GCA env auth.
- Gateway auth sets a placeholder API key and can use custom headers/base URL
  when those values are provided by ACP.

Therefore direct user-managed gateway/base-url behavior should remain
experimental, but V1 can still support external routed models through the
adapter-owned loopback proxy described above. The supported path is:
shared `modelServices` -> routed `service,model` selector -> managed Gemini
gateway auth settings -> local compatibility proxy -> upstream
OpenAI-compatible `chat/completions` service.

### Runtime Model

Use a process-per-turn runtime. Gemini headless mode is the stable structured
automation surface; it is triggered by non-TTY execution or `-p/--prompt`.
Unlike Claude Code stream mode, Gemini does not expose a stable bidirectional
JSON input protocol for a long-lived headless process.

Set `GEMINI_CLI_NO_RELAUNCH=true` for V1 launches. Source inspection of
`@google/gemini-cli@0.38.0` shows the CLI otherwise spawns a child Node process
and exits with the child's status to apply memory-related Node flags. That
indirection makes interrupt/stop handling depend on process-tree cleanup. Since
Vibe Forge already starts a fresh process per turn, the adapter should keep the
Gemini process topology single-layered unless a future smoke test covers the
relaunch path explicitly.

Prompts should be sent through stdin by default. Passing large prompts through
`--prompt` can expose task content through process listings and command logs, and
can hit shell/OS argument length limits. `--prompt` remains a fallback for
environments where stdin behavior differs from the pinned Gemini CLI version.
The implementation should use `spawn(binary, args, { stdio: ... })` and write to
child stdin, not shell out through `printf | gemini`; the shell pipeline below is
only illustrative.

Source inspection of `@google/gemini-cli@0.38.0` shows stdin is read only when
`process.stdin.isTTY` is false. Gemini waits up to 500 ms for piped input and
truncates stdin after 8 MiB. The adapter must close child stdin after writing
the prompt, treat upstream truncation warnings as diagnostics, and fail early
for prompts whose serialized size would exceed the pinned CLI limit. Headless
mode is already triggered by Vibe Forge's piped stdio, but the adapter may also
pass `--prompt ""` as an explicit non-interactive marker if a future pinned CLI
requires it. It must not put the real prompt content in `--prompt`.

Gemini full-process sandboxing is incompatible with that prompt secrecy
guarantee in V1. When `tools.sandbox`, `GEMINI_SANDBOX`, or `--sandbox` enables
Gemini's sandbox relaunch path, the parent CLI reads piped stdin and appends it
to child-process `--prompt`. The adapter should therefore reject Gemini
full-process sandbox configuration for V1, rather than silently allowing prompt
content to appear in argv. Vibe Forge can still enforce its own sandbox outside
the Gemini CLI process, and a future Gemini sandbox mode needs a pinned smoke
test proving that stdin stays out of argv before it is enabled.

Gemini also has native prompt command syntax in non-interactive mode. A prompt
starting with `/` can execute built-in or custom slash commands, and unescaped
`@path` syntax can run Gemini's file-injection preprocessor before the prompt is
sent to the model. Custom commands may include shell injection blocks that request
confirmation and fail headless turns with input errors.

V1 should default `nativePromptCommands` to `reject`: before spawning Gemini,
detect native slash-command and at-command syntax in the user-authored prompt and
fail with a clear diagnostic. The adapter should not copy real user commands into
the mock home, should not manage project `.gemini/commands` in V1, and should not
use native command syntax for Vibe Forge assets. A future
`nativePromptCommands: "allow"` mode must prove that command-expanded prompts,
file injection, tool events, confirmation failures, and prompt-size checks remain
observable through the adapter contract.

For each user turn:

```bash
printf '%s' "$PROMPT" | gemini \
  --output-format stream-json \
  --model "<model>" \
  --approval-mode "<mode>"
```

For resume turns:

```bash
printf '%s' "$PROMPT" | gemini \
  --resume "<gemini-session-id>" \
  --output-format stream-json \
  --model "<model>" \
  --approval-mode "<mode>"
```

The adapter session object should queue `emit({ type: 'message' })` while a turn
is running and start the next headless process after the current process exits.
This preserves the `AdapterSession.emit` contract without inventing an
unsupported stdin protocol.

`AdapterQueryOptions.extraOptions` should not be appended blindly. The adapter
owns the positional prompt/stdin, `--prompt`, `--resume`, `--model`,
`--output-format`, and `--approval-mode` surfaces. A conservative V1 can start
with no arbitrary flag pass-through and add an allow-list only after tests prove
each flag is compatible with managed settings, hooks, MCP projection, session
resumption, and non-interactive output parsing.

The deny-list must include flags and subcommands that can bypass or conflict
with the managed runtime boundary:

- prompt/session/output ownership: `--prompt`, `--prompt-interactive`,
  positional query args, `--resume`, `--list-sessions`, `--delete-session`,
  `--output-format`, `--raw-output`, `--accept-raw-output-risk`;
- permission and policy ownership: `--approval-mode`, `--yolo`, `--policy`,
  `--admin-policy`, `--allowed-tools`, `--allowed-mcp-server-names`;
- workspace/config ownership: `--include-directories`, `--worktree`,
  `--extensions`, `--list-extensions`, `--sandbox`;
- protocol/test ownership: `--acp`, `--experimental-acp`, `--fake-responses`,
  `--record-responses`;
- subcommands that change native state outside a turn: `mcp`, `extensions`,
  `skills`, and `hooks`.

Lifecycle rules:

- Only one Gemini process may run per Vibe Forge session at a time.
- `emit({ type: 'message' })` appends to a per-session queue.
- `interrupt` kills the current process, clears queued prompts, and emits a
  non-fatal interrupted exit unless a fatal error was already emitted.
- `stop` kills the current process and prevents queued prompts from starting.
- Follow-up prompts after a successful exit resume the cached native Gemini
  session ID.
- Concurrent resume attempts for the same native Gemini session are disallowed.

Cache native session mapping under:

```ts
interface Cache {
  'adapter.gemini.sessions': Record<
    string,
    {
      geminiSessionId: string
      title?: string
    }
  >
}
```

The key is Vibe Forge `sessionId`; `geminiSessionId` comes from Gemini's
`session_id` in the `init` event.

Gemini also persists full native chat history outside the Vibe Forge cache. With
`GEMINI_CLI_HOME=.ai/.mock`, the pinned CLI stores project-scoped sessions under
`.ai/.mock/.gemini/tmp/<project_id>/chats/`, plus related project temp data such
as plans, trackers, task files, logs, memory, shell history, and checkpoints.
V1 should rely on this native store only for `--resume <uuid>` and should not use
`--resume latest`, `--list-sessions`, or `--delete-session` internally. If a
cached native session ID has been deleted by Gemini retention cleanup or by a
user, the adapter should clear the stale mapping and emit a resume diagnostic
instead of silently starting a different native conversation.

Gemini's documented default retention is 30 days. V1 should not expose a
Gemini-specific retention config until Vibe Forge has a cross-adapter retention
policy. It can pass through explicit `general.sessionRetention` in raw settings,
but should surface that setting in diagnostics because it can delete native
sessions while Vibe Forge still has a cache mapping.

### Output Event Mapping

Gemini `stream-json` is newline-delimited JSON with these documented event
types:

| Gemini event        | Vibe Forge event                                                      |
| ------------------- | --------------------------------------------------------------------- |
| `init`              | `init` with `uuid`, `model`, `adapter: 'gemini'`, version, cwd, tools |
| `message` user      | ignore by default to avoid duplicating persisted user messages        |
| `message` assistant | `message` with assistant text content                                 |
| `tool_use`          | assistant tool-call message                                           |
| `tool_result`       | tool-result message                                                   |
| `error`             | `error` with raw payload in `details`                                 |
| `result`            | completion status, fatal error payload if present, and usage stats    |
| process close       | `exit`                                                                |

In `@google/gemini-cli@0.38.0`, successful `stream-json` output emits assistant
text through `message` events with `role: "assistant"` and `delta: true`.
Successful `result` events contain `status: "success"` and `stats`, not the
final response text. Fatal stream errors are represented as `result` events with
`status: "error"` and an `error` object, while non-fatal warnings use the
`error` event type. V1 should therefore persist assistant chunks from
`message` events and treat `result` as completion metadata. The parser can still
ignore or de-duplicate a future `result.response` field defensively, but it must
not depend on that field for the final answer.

The parser must be forward-compatible:

- tolerate unknown top-level fields;
- keep raw payloads in debug logs or `details`;
- treat malformed non-empty stdout lines as diagnostics, because Gemini's
  feedback/console paths can still write human text around structured output;
- treat non-zero process exit as fatal only if no Gemini `result` with
  `status: "error"` was emitted first.

Exit code mapping:

| Gemini exit code | Vibe Forge handling                                      |
| ---------------- | -------------------------------------------------------- |
| `0`              | normal `exit`                                            |
| `1`              | fatal `error` unless Gemini already emitted error result |
| `41`             | fatal `error` with code `gemini_auth_error`              |
| `42`             | fatal `error` with code `gemini_input_error`             |
| `44`             | fatal `error` with code `gemini_sandbox_error`           |
| `52`             | fatal `error` with code `gemini_config_error`            |
| `53`             | fatal `error` with code `gemini_turn_limit_exceeded`     |
| `54`             | fatal `error` with code `gemini_tool_execution_error`    |
| `130`            | cancellation/interrupt, do not retry automatically       |
| other            | fatal `error` with code `gemini_process_exit_unexpected` |

For `stream-json`, Gemini's own fatal handler emits a `result` event with
`status: "error"`, `error.type`, `error.message`, and stats before exiting with
the numeric code. The adapter should surface that structured event as the primary
error and attach the numeric exit code as metadata when the process closes.

### Tool Call Names

Gemini built-in tool names should be namespaced as `adapter:gemini:<tool>`.
MCP tool names already follow Gemini's `mcp_<server>_<tool>` convention. The
adapter should preserve enough metadata to display both:

- original Gemini tool name;
- Vibe Forge normalized tool name;
- call id;
- input/output payloads;
- error status.

Gemini warns that MCP server aliases should avoid underscores because the policy
engine parses fully qualified names by the first underscore after `mcp_`.
`buildAdapterAssetPlan()` should either validate selected MCP names for Gemini
or the Gemini adapter should normalize generated runtime-only aliases. Workspace
configured names should not be silently renamed without a diagnostic, because
renaming changes user-facing tool names.

### Permission Mode Mapping

Map Vibe Forge permission modes to Gemini approval modes:

| Vibe Forge mode     | Gemini mode | Notes                                                                                      |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| unset / `default`   | `default`   | Headless non-interactive tool confirmations may deny rather than ask.                      |
| `acceptEdits`       | `auto_edit` | Closest match: auto-approve edit tools, prompt/deny others.                                |
| `plan`              | `plan`      | Gemini docs describe this as read-only and still under development.                        |
| `dontAsk`           | `default`   | Prefer non-interactive denial over silently escalating to YOLO. Revisit after smoke tests. |
| `bypassPermissions` | `yolo`      | Use `--approval-mode=yolo`; never pass deprecated `--yolo`.                                |

This mapping intentionally does not treat `dontAsk` as `yolo`. In Codex,
`dontAsk` means no approval escalation while staying inside the current sandbox.
Gemini has no exact public equivalent. Default headless behavior is safer until
tests prove a better mapping.

Gemini folder trust should not be managed by the V1 adapter. Source inspection
of `@google/gemini-cli@0.38.0` shows that `isWorkspaceTrusted()` returns trusted
in headless mode, and Vibe Forge's runtime uses non-TTY stdio. Interactive
Gemini can downgrade non-default approval modes when a folder is untrusted, so
V1 should add an E2E assertion that headless `auto_edit`, `plan`, and `yolo`
requests are not downgraded. This is separate from MCP server `trust: true`,
which V1 still must not add automatically.

V1 should not use Gemini's policy engine as the primary Vibe Forge permission
mapping. The adapter should not synthesize `policyPaths`, `adminPolicyPaths`,
`tools.allowed`, or `mcp.allowed`, and should reject `tools.allowed` when it would
auto-approve tools outside the selected Vibe Forge permission mode. Restrictive
policy settings such as `tools.exclude`, `tools.core`, system admin policies, or
enterprise policy files may still apply as external constraints; surface them as
diagnostics rather than silently weakening Vibe Forge's own permission display.

### Managed Permission Integration

Gemini native `BeforeTool` hooks can be blocking, so the built-in permission
plugin should participate once the Gemini native hook bridge is active. Required
changes:

- Add `gemini` to `syncPermissionStateMirror()` and
  `createBuiltinPermissionPlugin()` adapter allow-lists.
- Reuse the existing `.ai/.mock/permission-state/<adapter>/<session>.json`
  mirror path; no schema change is needed.
- Set the shared `NATIVE_HOOK_BRIDGE_ADAPTER_ENV` to `gemini` when managed
  native hooks are installed.
- Extend `normalizePermissionToolName()` or the Gemini bridge input mapper so
  Gemini MCP names like `mcp_<server>_<tool>` resolve to the server-level
  permission subject. This must account for Gemini's underscore ambiguity.
- Keep `trust: true` out of generated runtime MCP config unless explicitly
  configured, so remembered Vibe Forge permissions do not get bypassed by
  adapter defaults.

### System Prompt Handling

Do not set `GEMINI_SYSTEM_MD` by default.

Gemini's `GEMINI_SYSTEM_MD` is a full replacement of the built-in system prompt,
not an append mechanism. Replacing it with Vibe Forge generated context would
risk losing Gemini's native tool, safety, skills, and workflow instructions.

V1 should implement `systemPromptMode: 'prompt-prelude'`:

1. Convert `AdapterQueryOptions.systemPrompt` into a clearly delimited
   "Vibe Forge runtime instructions" prelude.
2. Prepend that prelude to the first prompt, and also to resumed process-per-turn
   prompts when `appendSystemPrompt !== false`.
3. Keep Gemini native `GEMINI.md`, skills, MCP, and hooks behavior intact.

`systemPromptMode: 'system-md'` can be an advanced opt-in that writes a managed
`.gemini/system.md` and sets `GEMINI_SYSTEM_MD=1`. It must warn that this is a
replacement mode.

### Native Context and Memory

Gemini's `GEMINI.md` context system is separate from `GEMINI_SYSTEM_MD`. In the
pinned CLI, headless mode is treated as trusted, so normal headless turns load
the mock-home global context file plus the workspace `GEMINI.md` hierarchy.
Extension context files disappear when extensions are disabled.

V1 should preserve committed workspace `GEMINI.md` discovery by default, because
it is normal Gemini project context and is not equivalent to replacing the system
prompt. V1 should not synthesize `context.fileName`, should not add `AGENTS.md`
to Gemini native memory automatically, and should not copy the user's real
`~/.gemini/GEMINI.md` into the mock home.

Context expansion needs a stricter boundary:

- Reject `--include-directories` and strip or reject
  `GEMINI_CLI_IDE_WORKSPACE_PATH` in default V1 launches.
- Diagnose `context.includeDirectories` and
  `context.loadMemoryFromIncludeDirectories: true` in workspace or raw adapter
  settings. A future feature can map Vibe Forge workspace roots into these
  fields deliberately.
- Keep `experimental.jitContext` and `experimental.memoryManager` off by default;
  warn when inherited settings enable them because they change memory loading and
  memory-write behavior outside the V1 test matrix.
- Surface Gemini `save_memory` as a normal tool call/result. If it writes, the
  target should be the mock home or Gemini's private project memory location, not
  the user's real home.

### Native Assets

Add `gemini` to `WorkspaceAssetAdapter`.

MCP:

- Convert selected Vibe Forge MCP servers into Gemini `mcpServers`.
- Use `httpUrl` for streamable HTTP servers and `url` for SSE servers.
- Preserve `command`, `args`, `env`, `cwd`, `headers`, `timeout`, `trust`.
- Map `include`/`exclude` tool selection to `includeTools`/`excludeTools`.
- Do not automatically set `trust: true` for runtime companion MCP servers.
  Trust bypasses Gemini confirmations and should require explicit config or a
  separate policy decision.
- Validate or warn on server aliases containing underscores.

Skills:

- Gemini discovers workspace skills from `.gemini/skills/` and `.agents/skills/`.
- Gemini discovers user skills from `~/.gemini/skills/` and `~/.agents/skills/`.
- The adapter should project selected workspace skills into a session-managed
  native directory, not directly mutate committed `.gemini/skills`.
- The preferred target is the mock home `~/.agents/skills` alias plus a
  workspace `.gemini/skills` projection only when the source asset is already a
  workspace-scoped skill selected for this run.
- Skill activation uses Gemini's `activate_skill` tool and may require consent.
  Headless runs must verify that activation behaves correctly under
  `default`, `auto_edit`, and `yolo` approval modes. Native skill projection is
  not sufficient if the model cannot activate the skill in non-interactive
  mode.
- If activation is blocked in safe modes, V1 should surface a clear diagnostic
  and continue relying on Vibe Forge prompt assets for selected skills.
- Extension-provided skills are outside V1 because extensions are disabled by
  default.

Hooks:

- Generate `.ai/.mock/.gemini/settings.json` with managed hook entries.
- Set `__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__=1` when hooks are
  installed successfully.
- Extend task native bridge de-duplication for Gemini so managed bridge hooks do
  not double-fire with native Gemini hooks.

Other Gemini assets:

- Do not manage extensions in V1. Because Gemini loads all installed extensions
  by default, V1 should set `admin.extensions.enabled: false` unless the user
  explicitly opts into an untested future extension mode.
- Do not manage custom slash commands in V1. Project `.gemini/commands` and
  mock-home `.gemini/commands` should not participate while
  `nativePromptCommands` defaults to `reject`.
- Do not manage subagents in V1. Because Gemini enables local and remote subagents
  by default, V1 should set `experimental.enableAgents: false` unless the user
  explicitly opts into an untested future subagent mode.
- Do not manage checkpoint files in V1.
- Do not enable Gemini browser/devtools agent features by default. If user
  settings enable browser agents, Vibe Forge should preserve them but log that
  browser-side effects are outside the Gemini adapter V1 test matrix.

### Native Hook Bridge

Gemini native hooks use JSON over stdin/stdout and are configured in
`settings.json` under `hooks`.

V1 bridge mapping:

| Vibe Forge hook    | Gemini hook    |
| ------------------ | -------------- |
| `PreToolUse`       | `BeforeTool`   |
| `PostToolUse`      | `AfterTool`    |
| `UserPromptSubmit` | `BeforeAgent`  |
| `Stop`             | `AfterAgent`   |
| `SessionStart`     | `SessionStart` |
| `Notification`     | `Notification` |
| `PreCompact`       | `PreCompress`  |

V1 should not map:

- `SessionEnd`;
- `BeforeModel`;
- `AfterModel`;
- `BeforeToolSelection`;
- Gemini tail-tool-call output.

`SessionEnd` is intentionally framework-owned in V1 because the shared hook
bridge already emits it from the adapter `exit` event. Mapping Gemini native
`SessionEnd` at the same time would double-fire unless `SessionEnd` is added to
the native bridge de-duplication contract. The other events either have no Vibe
Forge equivalent today or require new shared hook contracts.

### Built-In Models

Expose a `builtinModels` list in `@vibe-forge/adapter-gemini/models`:

- `auto`
- `auto-gemini-3`
- `auto-gemini-2.5`
- `gemini-3-pro-preview`
- `gemini-3-flash-preview`
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`

Use `auto` as the default model. Gemini CLI may route subagent or utility calls
to other models even when `--model` is set, so UI copy should avoid implying
that all internal calls use the selected model.

Gemini model precedence in the pinned CLI is `--model`, then `GEMINI_MODEL`,
then `settings.model.name`, then the CLI default. The adapter should always pass
the Vibe Forge-resolved model through `--model`, including the default `auto`,
so ambient `GEMINI_MODEL` or workspace `settings.model.name` cannot silently
change a Vibe Forge session. If users want ambient Gemini model selection, they
can set `adapters.gemini.defaultModel` or choose a Gemini model in the normal
Vibe Forge model selector.

If Gemini emits a model update or usage metadata showing a model different from
the requested model, the adapter should include that data in session info or
event details without overwriting the user-selected model unless Gemini reports
the main chat model changed for the session.

Do not add Gemini to `supportedEffortAdapters` until Gemini CLI exposes a
stable public effort/thinking flag that maps to Vibe Forge `EffortLevel`.

### External Model Services

Vibe Forge supports external model services through `modelServices` and
`service,model` selectors. Existing adapters handle this in adapter-specific
ways:

- The shared config type is `ModelServiceConfig`, whose provider-host field is
  `apiBaseUrl`; there is no separate repository-wide adapter `apiHost` field.
- Claude Code uses Claude Code Router.
- Codex emits `model_provider.*` overrides and may use the local proxy.
- OpenCode writes AI SDK provider config into its session config.
- No first-party Copilot adapter was found in this repository during this RFC
  pass.

Gemini CLI's documented model selection surface is different. The selected
primary model is resolved from `--model`, `GEMINI_MODEL`, `model.name` in
`settings.json`, local model routing, and then Gemini CLI's default model.
The documented local model routing feature is experimental and uses a local
Gemma model for routing decisions; it is not a general replacement for the main
chat model or Vibe Forge `modelServices`.

V1 should therefore support two Gemini model-selection paths:

- Native Gemini model names, including `auto`, `auto-gemini-*`, and
  `gemini-*`.
- Routed `service,model` selectors that resolve to shared `modelServices`
  entries whose upstream protocol is OpenAI-compatible `chat/completions`.

Validation rules in V1:

- Pass through unknown plain model names only for forward compatibility with new
  Gemini releases, and include a warning if the name is not in built-in
  metadata.
- Accept `service,model` only when the resolved service exists and its upstream
  wire protocol is `chat/completions`.
- Reject services configured for OpenAI Responses API or other non-supported
  protocols before process launch with a clear fatal error.
- Do not add a Gemini-specific adapter `apiHost`, `apiBaseUrl`, `baseUrl`, or
  `provider` field; external providers continue to be declared through shared
  `modelServices`.
- Allow adapter-managed route extras such as proxy headers/query params and
  provider compatibility toggles like `extra.gemini.disableThinking`, but keep
  those as route-level metadata rather than new top-level Gemini provider
  config.

Example routed config:

```yaml
modelServices:
  kimi:
    apiBaseUrl: https://api.moonshot.ai/v1/chat/completions
    apiKey: ${KIMI_API_KEY}
    models:
      - kimi-k2.5
    extra:
      gemini:
        disableThinking: true

adapter: gemini
model: kimi,kimi-k2.5
```

Frontend model selection should not pretend routed services are native Gemini
built-ins. If surfaced in the picker, they should remain visually distinct from
Gemini-native models. The server/adapter must still validate defensively
because sessions can be started through CLI or API paths that bypass the client
picker.

### Frontend and Server Integration

Required frontend work:

- Add `@vibe-forge/adapter-gemini` to `apps/client/package.json`.
- Import `adapterDisplayName` and `adapterIcon` from `./icon`.
- Add Gemini to `adapterDisplayMap`.
- Keep routed service models visually distinct from Gemini built-ins when the
  selected adapter is Gemini, and validate selection server-side.
- Leave sender effort controls disabled for Gemini in V1.

Required server/task work:

- Add Gemini to asset-plan-supported adapters, but not effort-supported
  adapters. This means splitting `supportedAssetPlanAdapters` away from
  `supportedEffortAdapters` in `@vibe-forge/task`.
- Widen the `buildAdapterAssetPlan()` adapter union and
  `WorkspaceAssetAdapter`.
- Add Gemini native skill support to `adapter-capabilities` and prompt selection
  so selected native skills are not redundantly injected as prompt assets when
  native projection is expected.
- Add Gemini native hook bridge de-duplication for
  `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop`.
  Do not disable framework `SessionEnd` unless native `SessionEnd` becomes part
  of Vibe Forge's de-dup contract.
- Add Gemini to built-in permission mirror and native permission plugin
  allow-lists.
- Ensure server permission recovery paths do not assume Codex/Claude-only native
  permission events.
- Ensure session restarts after completed Gemini headless turns reuse cached
  Gemini session IDs.
- Ensure stop/restart flows do not start concurrent `gemini --resume` processes
  for the same session.
- Validate Gemini model inputs in the adapter runtime so explicit
  `service,model` selectors fail before launching the CLI.

Required tooling work:

- Add `gemini` to adapter E2E target types, scenario selection, harness
  validation, and snapshot normalization.
- Add Gemini-specific cases to `scripts/__tests__/adapter-e2e/cases.ts` rather
  than scattering case definitions across the harness.

## Migration Plan

1. Add package skeleton and exports.
2. Add path resolution, adapter config augmentation, and built-in models.
3. Register the workspace package in root/app dependencies where current
   adapters are explicitly listed.
4. Decide whether bundled Gemini optional native dependencies need pnpm
   `onlyBuiltDependencies` entries.
5. Implement settings writer for mock home `.gemini/settings.json`, including
   managed extension-disable settings.
6. Implement auth-state preflight for env and `.env` credentials; keep real-home
   OAuth reuse behind a pinned-version feature gate until storage behavior is
   covered.
7. Implement stream parser with unit tests using fixture JSONL.
8. Implement process-per-turn session runtime and cache mapping.
9. Add workspace asset and task integration points, explicitly separating asset
   plan support from effort support.
10. Add Gemini hook bridge, native hook installation, permission mirror support,
    and native permission plugin support.
11. Add frontend display imports and package dependency.
12. Add adapter E2E target wiring, Gemini smoke cases, and snapshots.
13. Run focused checks, then full typecheck/lint/format where practical.

## Test Plan

Unit tests:

- `stream.ts`: `init`, assistant `message`, `tool_use`, `tool_result`, `error`,
  success `result`, error `result`, malformed JSON, and split chunks. The
  success path must not require `result.response`, and malformed non-JSON stdout
  lines should become diagnostics rather than parser crashes.
- `settings.ts`: MCP conversion, hook config generation, alias diagnostics, raw
  settings merge, default `admin.extensions.enabled: false`, default
  `experimental.enableAgents: false`, and diagnostics for permission-affecting
  Gemini policy/tool settings.
- auth/home setup: environment auth, Gemini `.env` discovery precedence,
  missing auth error, `NO_BROWSER=true` fast failure, `GEMINI_CLI_HOME`
  isolation, no mutation of real settings files, and no blind copy/link of real
  auth directories.
- native context: mock-home global `GEMINI.md` isolation, workspace `GEMINI.md`
  preservation, no automatic `AGENTS.md` mapping, diagnostics for
  `context.includeDirectories` and `context.loadMemoryFromIncludeDirectories`,
  and `save_memory` writes staying out of the real home.
- folder trust: the adapter never writes `trustedFolders.json` in V1, and
  headless approval modes are not downgraded when the real/mock trust files are
  empty.
- auth selection: env-derived auth without generated `selectedType`, explicit
  `security.auth.selectedType`, enforced-type mismatch, `useExternal`, and
  early diagnostics for credential/auth-type conflicts.
- policy/tool settings: no generated `policyPaths`, `adminPolicyPaths`,
  `tools.allowed`, or `mcp.allowed`; `tools.allowed` auto-approval conflicts fail
  early; restrictive external policy settings become diagnostics.
- environment merge: preserves auth/proxy/Code Assist env, applies managed
  `GEMINI_CLI_HOME`, `NO_BROWSER`, and `GEMINI_CLI_NO_RELAUNCH`, keeps
  adapter-resolved `--model` ahead of ambient `GEMINI_MODEL`, handles
  `telemetry: "off"` env/settings overrides, rejects attempts to override
  managed isolation through adapter env, rejects `GEMINI_SANDBOX`, and rejects
  `GEMINI_SYSTEM_MD`, `GEMINI_WRITE_SYSTEM_MD`,
  `GEMINI_CLI_IDE_WORKSPACE_PATH`, and `GEMINI_CLI_EXTENSION_REGISTRY_URI` unless
  the matching future opt-in mode is enabled; inherited
  `GEMINI_CLI_SYSTEM_SETTINGS_PATH` / `GEMINI_CLI_SYSTEM_DEFAULTS_PATH` produce
  diagnostics and cannot be set by adapter config.
- experimental endpoint env: explicitly set `GOOGLE_GEMINI_BASE_URL`,
  `GOOGLE_VERTEX_BASE_URL`, `CODE_ASSIST_ENDPOINT`, and custom header env are
  preserved, but generated `modelServices` are not converted into them.
- CLI args: adapter-owned flags are generated deterministically, arbitrary
  `extraOptions` are rejected by default, and deny-listed flags/subcommands
  produce clear adapter errors.
- prompt transport: prompt content is written to child stdin, child stdin is
  closed after write, prompt content is not present in argv, and oversized input
  fails before Gemini's 8 MiB stdin truncation.
- native prompt commands: leading slash commands, custom command syntax, and
  unescaped `@path` command syntax are rejected by default; opt-in allow mode is
  covered separately before release.
- Gemini sandbox rejection: `--sandbox`, `GEMINI_SANDBOX`, and merged
  `tools.sandbox` all fail with an adapter diagnostic until a pinned sandbox
  relaunch test proves prompt content remains out of argv.
- `session.ts`: create args, resume args, permission mapping, cache write, queue
  behavior, interrupt/stop behavior, process error handling, and exit code
  mapping for `1`, `41`, `42`, `44`, `52`, `53`, `54`, `130`, and unknown
  non-zero exits.
- native session store: cached `geminiSessionId` resumes by UUID, `latest` is
  never used, missing/deleted native sessions clear stale cache mappings, and
  `general.sessionRetention` settings produce diagnostics.
- process topology: `GEMINI_CLI_NO_RELAUNCH=true` keeps the spawned process as
  the real turn process; if disabled in a future mode, tests must prove
  interrupt/kill handles the full process tree.
- model validation: native Gemini names pass, explicit `service,model`
  selectors fail with `gemini_external_model_unsupported`, and unknown plain
  names produce the intended warning/pass-through behavior.
- event assembly: assistant text is assembled from `message` deltas, `result`
  is treated as completion metadata, and a future `result.response` is
  de-duplicated if Gemini adds it.
- `hook-bridge.ts`: Gemini native payload to Vibe Forge hook input and output
  conversion.
- `workspace-assets`: Gemini diagnostics and native skill/MCP projection.
- permissions: Gemini `mcp_<server>_<tool>` subject normalization, mirror
  writes, built-in permission hook participation, and a regression check that
  Gemini does not downgrade approval mode in headless mode.

Integration tests:

- `@vibe-forge/task` attaches Gemini asset plans.
- Gemini does not accept `effort` unless support is added.
- Gemini asset-plan support remains enabled even though Gemini effort support is
  disabled.
- Gemini accepts routed `service,model` selectors for OpenAI-compatible
  `chat/completions` services and rejects Responses-style selectors before
  process launch.
- Gemini does not expose a first-class `apiHost` / `apiBaseUrl` / `provider`
  adapter config in V1; endpoint-like behavior is only reachable through
  explicit `adapters.gemini.env` and raw settings.
- Ambient `GEMINI_MODEL` and workspace `settings.model.name` do not override
  the model selected through Vibe Forge.
- Server session persists `adapter: 'gemini'` and model from init.
- Server follow-up prompts resume the cached Gemini session and do not start
  concurrent native resume processes.
- Native bridge de-duplication suppresses framework-owned
  `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop`
  without suppressing framework `SessionEnd`.
- Client model/adapter selectors display Gemini built-ins.
- Client model/adapter selectors do not present routed service models as normal
  Gemini built-ins.
- Adapter E2E `run`, `test`, and snapshot normalization accept `gemini`.

E2E:

```bash
pnpm tools adapter-e2e run gemini-smoke
pnpm test:e2e:adapters
pnpm typecheck
pnpm exec eslint .
pnpm exec dprint check
```

Gemini-specific E2E cases:

- env-auth smoke with `stream-json`;
- real-home OAuth reuse smoke only if pinned artifact discovery and selectedType
  projection are implemented;
- MCP injection smoke with a server alias that does not contain underscores;
- MCP underscore alias diagnostic;
- skill discovery and activation behavior under `default`, `auto_edit`, and
  `yolo`;
- hook bridge smoke for `SessionStart`, `BeforeTool`, `AfterTool`,
  `BeforeAgent`, and `AfterAgent`;
- stop/interrupt behavior while Gemini is executing a tool.
- future-gated gateway/base-url smoke against a fake local GenAI-compatible
  endpoint. This should be marked experimental and must not be required for V1
  unless the RFC is updated to expose gateway support.

## Risks and Mitigations

### Gemini CLI protocol drift

Gemini CLI is moving quickly. `stream-json` fields can change between releases.
Keep the parser permissive and pin the upstream package version initially.

### System prompt replacement

`GEMINI_SYSTEM_MD` is a full replacement. Defaulting to it could break Gemini's
native behavior. Use prompt prelude by default and make replacement opt-in.

### Permission mismatch

`dontAsk` has no exact Gemini equivalent. Start with the safe mapping and verify
with real CLI tests before changing behavior.

### Folder trust drift

Gemini interactive mode can gate non-default approval modes on folder trust, but
the pinned CLI currently treats headless mode as trusted. V1 should not write
real or mock trust files. Instead, it should regression-test that headless
approval modes are honored so future upstream changes do not silently downgrade
`acceptEdits`, `plan`, or `bypassPermissions`.

### Ambient model drift

Gemini honors `GEMINI_MODEL` and `settings.model.name` when `--model` is absent.
Always passing the resolved Vibe Forge model prevents an inherited shell
variable or workspace setting from silently changing the selected model.

### External model mismatch

Vibe Forge model services are usually OpenAI-compatible provider definitions,
while Gemini CLI does not currently document a general primary-model external
provider interface. Reject explicit service selectors in V1 instead of passing
them through and letting Gemini fail with an unclear model error.

### Endpoint confusion

Gemini CLI has several endpoint-looking knobs, but they mean different things:
`CODE_ASSIST_ENDPOINT` is for Code Assist server development/testing, proxy
environment variables are transport-level, GenAI SDK base URL env vars are
undocumented at the Gemini CLI adapter contract level, and local Gemma router
host only affects routing decisions. Treating any of these as a general model
provider base URL would create misleading behavior.

### Headless process lifecycle

Process-per-turn may differ from long-lived Claude/Codex sessions. Cache native
session IDs and queue `emit()` calls to preserve the adapter contract.
Gemini's own Node relaunch path adds another lifecycle hazard because the
adapter may observe the parent while the real turn runs in a child. V1 should set
`GEMINI_CLI_NO_RELAUNCH=true`; any future mode that allows relaunch must own
process-group cleanup and prove interrupt/stop semantics with tests.

### Native session retention

Gemini stores full session history in its native project temp store and may clean
old sessions independently of Vibe Forge's cache mapping. The adapter should
handle stale native IDs explicitly so a resumed Vibe Forge session never attaches
to Gemini's `latest` session by accident.

### Prompt transport and sandbox relaunch

Gemini's pinned CLI reads piped stdin with a finite wait and an 8 MiB cap.
Relying on upstream truncation would silently corrupt prompts and asset context.
The adapter should measure serialized input before spawn, close stdin after
writing, and surface a Vibe Forge input-size error before Gemini truncates.
Full-process Gemini sandboxing adds a second prompt risk because the pinned CLI
injects piped stdin into `--prompt` during sandbox relaunch. V1 should reject
Gemini sandbox configuration instead of weakening the stdin-only transport
contract.

### Native prompt command syntax

Gemini can interpret user text as slash commands or `@` file-injection commands
before the model sees it. This can bypass Vibe Forge's prompt assembly, run custom
command preprocessors, read files outside adapter-managed assets, or fail a turn
with a headless confirmation error. V1 should reject that syntax by default and
revisit opt-in support only after command expansion is represented in adapter
events.

### MCP alias underscores

Gemini policy parsing can fail silently when MCP server aliases contain
underscores. Emit diagnostics and avoid silently changing configured names.

### Native skill scope

Directly writing `.gemini/skills` in the repository can create dirty worktrees.
Use managed mock/session projections unless the source asset already belongs to
the workspace and the projection is explicitly expected.

### Authentication state

Mock-home execution can hide real Gemini login state, and Gemini's
non-interactive validator does not infer auth from cached credentials. The V1
adapter should prefer env or `.env` credentials, set `NO_BROWSER=true`, and fail
before process launch with a clear setup message. Any real-home OAuth reuse must
be explicitly version-gated, must project only the required auth selector into
managed settings, and must not copy whole real-home config directories.

### Settings shadowing

Workspace `.gemini/settings.json` can override mock-home user settings. Managed
MCP and hook entries should emit diagnostics when workspace settings shadow them.

### System settings shadowing

Gemini system settings can override both mock-home user settings and workspace
settings. The adapter cannot safely suppress enterprise policy, but it should not
set system settings path env vars itself and should surface inherited system
settings paths because they can explain unexpected auth, telemetry, permission,
or tool behavior.

### Context expansion

Gemini headless mode treats the workspace as trusted and can load `GEMINI.md`
files from the workspace hierarchy. That native behavior is expected, but
`includeDirectories`, IDE workspace roots, JIT context, and memory-manager settings
can expand or mutate context outside the adapter's owned workspace boundary. V1
should diagnose or reject those expansion surfaces until Vibe Forge deliberately
maps them.

### Policy shadowing

Gemini policy files and deprecated `tools.allowed` settings can change whether
tools run without confirmation, while `tools.exclude`, `tools.core`, and admin
policies can hide or deny tools that Vibe Forge expects to display. V1 should not
encode its own permission model through Gemini policy files; it should surface
external policies as diagnostics and reject auto-approval settings that broaden
the selected permission mode.

### Authentication setting shadowing

Workspace or raw adapter settings can force `security.auth.selectedType`,
`security.auth.enforcedType`, or `security.auth.useExternal` in ways that defeat
env-auth inference. The adapter should diagnose these values before process
launch, especially when a selected auth type conflicts with available
credentials or when `gateway` is selected without a tested headless base-url
path.

### Package size and native optional dependencies

Depending directly on `@google/gemini-cli` increases install size and pulls
optional native packages. If this becomes too costly, the fallback is to require
a user-installed binary and make package dependency optional.

### Package manager build policy

Gemini's optional native dependencies may require package-manager build approval
or explicit `onlyBuiltDependencies` entries. The adapter should test clean
installs on a fresh workspace and decide whether skipped optional builds are
acceptable.

### Browser agent side effects

Gemini may include browser/devtools capabilities through user settings or bundled
assets. V1 does not test or control those side effects, so the adapter should
not enable them by default.

### Extension side effects

Gemini extensions are enabled by default upstream and can contribute MCP servers,
skills, themes, and long-running extension processes from the mock home. V1
should disable extensions through managed settings and reject extension registry
env/config until a future adapter mode defines install, trust, process cleanup,
and asset ownership semantics.

### Subagent side effects

Gemini local and remote subagents are enabled by default upstream. They can add
extra model calls, separate prompts, additional tool scopes, and Agent2Agent
credential storage that Vibe Forge V1 does not expose. V1 should disable
subagents through managed settings and keep any future subagent mode behind an
explicit opt-in and smoke test.

### Telemetry prompt logging

Gemini telemetry supports prompt logging when telemetry is enabled. The adapter
should default to `telemetry: "off"` and disable both Gemini telemetry and usage
statistics through managed env/settings. `telemetry: "inherit"` should be an
explicit opt-in; diagnostics should still redact telemetry env and warn if prompt
logging is enabled by inherited settings.

### Duplicate hook delivery

Gemini can emit native lifecycle hooks that overlap with Vibe Forge's framework
hook bridge. V1 should keep `SessionEnd` framework-owned and test the
de-duplication list for every event mapped through native hooks.

### Unsafe extra option pass-through

Letting arbitrary Gemini CLI flags through can bypass managed settings, expose
prompt content, or break session resumption. V1 should either allow-list safe
flags or reject conflicting flags with a clear error.

## Alternatives

### Shell wrapper only

Run `gemini -p` and expose only final text. This is simpler but loses tool call
display, native hooks, MCP diagnostics, permissions, and session state. Rejected.

### User-installed binary only

Require users to install `gemini` themselves and never add `@google/gemini-cli`
as a workspace dependency. This keeps Vibe Forge lighter and avoids optional
native dependency churn, but it makes version pinning and E2E reproducibility
harder. Keep this as a fallback if the package dependency proves too expensive.

### Use `GEMINI_SYSTEM_MD` for all system prompts

This gives a cleaner system prompt surface but replaces Gemini's native prompt.
Rejected as default because it is too risky for tools and skills.

### Long-lived interactive TTY automation

Drive Gemini's interactive UI through a pseudo-terminal. This would be fragile,
hard to test, and worse than the documented headless JSONL path. Rejected.

### Map `dontAsk` to `yolo`

This avoids prompt failures in headless mode but expands permissions beyond the
meaning used by other adapters. Rejected until there is explicit product intent.

## Open Questions

- Should `cliPath` override use a file path only, or support `{ command, args }`
  for package-manager wrappers?
- Should `@google/gemini-cli` be a required dependency, optional dependency, or
  unsupported in published packages with only global binary support?
- Should V1 implement real-home OAuth reuse at all, or require env/`.env` auth
  until there is a pinned storage contract for `oauth_creds.json`, keychain, and
  `gemini-credentials.json`?
- If real-home OAuth reuse is supported, should the adapter project
  `security.auth.selectedType: "oauth-personal"` automatically after verifying
  credentials, or require explicit user config?
- Should managed Gemini settings fail when workspace `.gemini/settings.json`
  shadows hooks/MCP, or is a warning enough?
- Should inherited Gemini system settings be treated as hard blockers when they
  override V1 managed fields, or only reported as diagnostics?
- Should a future interactive Gemini adapter mode expose folder trust controls,
  or should Vibe Forge keep Gemini strictly headless?
- Should prompt transport always use stdin, or should `--prompt` remain
  configurable for debuggability?
- Should Gemini native prompt command syntax stay rejected by default, or should
  Vibe Forge expose an explicit mode for slash commands and `@` file injection?
- Should Gemini full-process sandboxing stay unsupported, or can a future pinned
  CLI version preserve stdin transport through sandbox relaunch?
- Should `GEMINI_CLI_NO_RELAUNCH=true` remain a managed invariant, or should a
  future adapter mode support Gemini's child-process relaunch with process-group
  cleanup?
- Should Vibe Forge own Gemini native session retention, or leave
  `general.sessionRetention` entirely to raw Gemini settings?
- Should Gemini routed-service support stay limited to OpenAI-compatible
  `chat/completions`, or expand to Responses / other upstream protocols later?
- Should provider-specific compatibility shims such as
  `extra.gemini.disableThinking` stay heuristic by default for Kimi/Moonshot,
  or require explicit per-service opt-in?
- Should `CODE_ASSIST_ENDPOINT` and `GEMINI_CLI_SURFACE` get first-class adapter
  config fields, or is `adapters.gemini.env` enough?
- Should direct user-managed `GOOGLE_GEMINI_BASE_URL` /
  `GOOGLE_VERTEX_BASE_URL` remain unsupported except for adapter-managed routed
  services, or become a documented experimental escape hatch?
- Should Gemini `gateway` auth stay reserved for adapter-managed routed
  services, or can headless mode safely expose it as a user-tunable setting?
- Should Vibe Forge ever add a generic adapter `apiHost` field, or should each
  adapter keep provider-specific endpoint knobs isolated?
- Should `GEMINI_CLI_HOME` fully replace `HOME=.ai/.mock` for Gemini, or should
  a compatibility fallback remain for older CLI versions?
- Should unknown plain model names be passed through for future Gemini models, or
  hard-rejected unless listed in built-in metadata?
- Should `dontAsk` map to Gemini `default`, a generated policy file, or a custom
  denied-tools configuration?
- Should a future version use Gemini policy files for durable Vibe Forge
  permissions, or keep all permission decisions in hooks/mirrors?
- Should Gemini MCP server names with underscores be hard errors, warnings, or
  adapter diagnostics?
- Should Vibe Forge expose Gemini's `--allowed-mcp-server-names` and policy
  engine separately from `mcpServers` selection?
- Should `systemPromptMode: 'system-md'` be implemented in V1 or deferred until
  real smoke tests prove prompt prelude is insufficient?
- Should Gemini `BeforeToolSelection` become a new shared Vibe Forge hook event?
- How should Gemini plan approval artifacts map to Vibe Forge plans, if at all?
- Should Gemini browser/devtools agent support be explicitly disabled in managed
  settings, or should user settings always win?
- Should Gemini extensions remain disabled permanently in V1, or should there be
  a separate opt-in mode with isolated extension install/trust policy?
- Should Gemini subagents remain disabled permanently in V1, or should Vibe Forge
  expose a native subagent mode after remote/local tool scopes are mapped?
- Should committed workspace `GEMINI.md` always be preserved, or should Vibe Forge
  offer a strict mode that disables native Gemini context files entirely?
- Should Gemini native `SessionEnd` stay framework-owned permanently, or should
  Vibe Forge add native `SessionEnd` de-duplication across all adapters?
- Which Gemini CLI flags, if any, should be allowed through `extraOptions`?
- Should `@google/gemini-cli` be pinned exactly or allowed as a caret range after
  the first adapter release?

## References

- Gemini CLI repository: https://github.com/google-gemini/gemini-cli
- Gemini CLI release v0.38.0: https://github.com/google-gemini/gemini-cli/releases/tag/v0.38.0
- NPM package: https://www.npmjs.com/package/@google/gemini-cli
- Headless mode: https://geminicli.com/docs/cli/headless/
- CLI cheatsheet: https://geminicli.com/docs/cli/cli-reference/
- Configuration reference: https://geminicli.com/docs/reference/configuration/
- Model routing: https://geminicli.com/docs/cli/model-routing/
- Local model routing: https://geminicli.com/docs/core/local-model-routing/
- Authentication setup: https://geminicli.com/docs/get-started/authentication/
- Session management: https://geminicli.com/docs/cli/session-management/
- Trusted folders: https://geminicli.com/docs/cli/trusted-folders/
- Policy engine: https://geminicli.com/docs/reference/policy-engine/
- System prompt override: https://geminicli.com/docs/cli/system-prompt/
- Telemetry: https://geminicli.com/docs/cli/telemetry/
- Agent skills: https://geminicli.com/docs/cli/skills/
- Hooks reference: https://geminicli.com/docs/hooks/reference/
- Plan mode: https://geminicli.com/docs/cli/plan-mode/
