---
rfc: 0001
title: Copilot Adapter Support
status: draft
author: Codex
created: 2026-04-15
updated: 2026-04-16
source_session: 019d913e-3ea0-7820-be31-5686c3e3f5bd
---

# Copilot Adapter Support

## Summary

Add a first-class `copilot` adapter to Vibe Forge.

The adapter is CLI-only for the first version:

- Direct mode starts the native Copilot TUI through `copilot --interactive`.
- Stream / print mode starts Copilot prompt mode through `copilot --prompt ... --output-format json --stream on`.
- The adapter parses Copilot JSONL events and emits normalized Vibe Forge `AdapterOutputEvent` values.
- Vibe Forge CLI output formatting remains outside the adapter. The adapter does not implement Vibe Forge `--output-format`; it only provides structured events for the existing CLI print layer.

The adapter uses workspace-owned config, instruction, and skill staging paths under `.ai/.mock/copilot` instead of writing managed files into the user's real Copilot home.

## Motivation

Vibe Forge adapters are runtime translators, not binary aliases. Copilot CLI has its own model flags, prompt mode, interactive TUI, MCP injection, skill discovery, permission flags, BYOK provider environment variables, and JSONL event stream.

Adding a dedicated adapter lets Vibe Forge use those native Copilot surfaces while preserving the shared task runtime:

- `vf run --adapter copilot --print ...` stays headless and script-friendly.
- `vf run --adapter copilot` can delegate the terminal to Copilot's native TUI.
- workspace assets still flow through Vibe Forge's shared asset planner.
- model selection and permission mode stay aligned with existing adapters.

## Goals

- Add `copilot` to shared adapter types, task runtime support lists, client display metadata, and package registration.
- Add `@vibe-forge/adapter-copilot`.
- Resolve the Copilot CLI from adapter config, Vibe Forge env override, adapter-local package binary, or `PATH`.
- Support direct mode through Copilot CLI inherited stdio.
- Support stream / print mode through Copilot CLI prompt mode with machine-readable JSONL.
- Map Copilot JSONL events into normalized adapter events: `init`, `message`, `error`, `stop`, and `exit`.
- Keep Vibe Forge `--print` non-interactive. It must not open Copilot TUI, pickers, browser prompts, or terminal UI.
- Stage Vibe Forge system prompt content as Copilot custom instructions.
- Stage selected Vibe Forge skills for Copilot native skill discovery.
- Pre-seed Copilot `trusted_folders` for the current workspace in managed runs, with an adapter config escape hatch to disable it.
- Translate selected Vibe Forge MCP servers into `--additional-mcp-config`.
- Map routed `modelServices` models into Copilot BYOK provider environment variables.
- Route external provider calls through an adapter-local proxy when `modelServices` is selected, matching the Codex observability pattern.
- Keep Vibe Forge task hook bridge active for Copilot in V1.
- Add focused unit tests for argument construction, event parsing, provider env mapping, system prompt / skill staging, asset planning, and direct mode.

## Non-Goals

- Do not use `@github/copilot-sdk` in V1.
- Do not promise SDK / CLI parity.
- Do not parse Copilot's terminal UI.
- Do not implement a custom interactive UI for `--print`.
- Do not auto-login users or copy real `~/.copilot` credentials.
- Do not implement Copilot plugin marketplace management.
- Do not translate OpenCode-only native assets into Copilot plugins in V1.
- Do not add a Copilot-native hook bridge in V1.
- Do not change behavior of `claude-code`, `codex`, or `opencode` except where shared adapter lists and asset planning need `copilot`.

## Design

### Runtime Modes

Direct mode:

```text
copilot --resume <vf-session-id> --interactive <prompt>
```

The adapter passes inherited stdio. Copilot owns terminal rendering, slash commands, login UI, native pickers, and TUI state.

Stream / print mode:

```text
copilot --resume <vf-session-id> \
  --prompt <prompt> \
  --output-format json \
  --stream on
```

The adapter reads stdout as JSONL. Copilot's `--output-format json` is only the child-process protocol used between the adapter and Copilot CLI. Vibe Forge's public `--output-format` stays owned by the existing CLI print layer, which consumes adapter events.

### Session Identity

Vibe Forge `sessionId` is passed as Copilot `--resume <id>`.

Copilot CLI creates a new session with that ID when no local session exists and resumes it when one does. The adapter stores the Vibe/Copilot session marker under cache key `adapter.copilot.session`.

### Managed Paths

Default managed paths:

```text
.ai/.mock/copilot/
  config and Copilot home

.ai/.mock/copilot/sessions/<session-id>/instructions/
  copilot-instructions.md

.ai/.mock/copilot/sessions/<session-id>/skills/
  <selected-skill> -> <workspace-or-plugin-skill-dir>
```

Child env:

- `COPILOT_HOME=<workspace>/.ai/.mock/copilot`
- `COPILOT_AUTO_UPDATE=false`
- `COPILOT_CUSTOM_INSTRUCTIONS_DIRS=<managed instructions dir>` when Vibe Forge has a system prompt
- `COPILOT_SKILLS_DIRS=<managed skills dir>` when selected skills are staged

The adapter also passes `--config-dir <workspace>/.ai/.mock/copilot`.

By default, the adapter merges the current workspace path into `.ai/.mock/copilot/config.json` under `trusted_folders`. This suppresses Copilot's folder trust prompt for managed runs without touching the user's real `~/.copilot`. Set `adapters.copilot.disableWorkspaceTrust=true` to skip this bootstrap.

### Asset Mapping

| Vibe Forge asset         | Copilot V1 mapping                                                          |
| ------------------------ | --------------------------------------------------------------------------- |
| system prompt            | generated `copilot-instructions.md` under managed instructions dir          |
| selected skills          | symlinked into managed skills dir and exposed through `COPILOT_SKILLS_DIRS` |
| selected MCP servers     | JSON passed to `--additional-mcp-config`                                    |
| hook plugins             | handled by Vibe Forge task hook bridge, diagnostic status `translated`      |
| OpenCode native overlays | diagnostic status `skipped`                                                 |

Selected Copilot skills are native assets, so prompt selection must not duplicate them in the generated skills route prompt.

### Model Mapping

Plain models map directly:

```text
model = "gpt-5" -> --model gpt-5
```

Routed Vibe Forge model services use the existing `<service>,<model>` shape:

```text
model = "local,gpt-5"
```

The adapter passes:

- `--model gpt-5`
- `COPILOT_PROVIDER_BASE_URL`
- `COPILOT_PROVIDER_API_KEY`
- `COPILOT_PROVIDER_TYPE`
- `COPILOT_PROVIDER_MODEL_ID`
- `COPILOT_PROVIDER_WIRE_MODEL`
- optional `COPILOT_PROVIDER_WIRE_API`
- optional `COPILOT_PROVIDER_BEARER_TOKEN`
- optional `COPILOT_PROVIDER_AZURE_API_VERSION`
- optional `COPILOT_PROVIDER_MAX_PROMPT_TOKENS`
- optional `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS`
- optional `COPILOT_OFFLINE=true`

Provider type defaults to `openai`.

### API Observability

For GitHub-hosted Copilot models, Vibe Forge can observe the process lifecycle and Copilot JSONL session events, but the upstream API calls are owned by Copilot CLI.

For routed `modelServices`, the intended parity target is the Codex local provider proxy:

- route Copilot provider base URL through a local Vibe Forge proxy;
- record request received, upstream forwarding, upstream response, completion duration, response byte count, and upstream error payload;
- attach ctx id, Vibe session id, runtime, adapter, service key, requested model, resolved model, and provider type.

Copilot consumes provider settings through environment variables, so the adapter rewrites `COPILOT_PROVIDER_BASE_URL` to a local proxy route and keeps the original service URL inside the route registry. Proxy records are written under:

```text
.ai/logs/<ctx-id>/<session-id>/adapter-copilot/provider-proxy.log.md
```

### Permissions

V1 uses Copilot CLI permission flags:

| Vibe Forge mode     | Copilot mapping     |
| ------------------- | ------------------- |
| `bypassPermissions` | `--allow-all`       |
| `acceptEdits`       | `--allow-all-paths` |
| `dontAsk`           | `--no-ask-user`     |
| `plan`              | `--plan`            |
| tool include        | `--available-tools` |
| tool exclude        | `--excluded-tools`  |

Deny/allow rule compilation can be expanded later after real CLI compatibility tests for Copilot permission pattern syntax.

### Hooks

V1 does not install a Copilot-native hook bridge. Vibe Forge hook plugins keep running through the existing task hook bridge.

Reasoning:

- Copilot CLI hooks are real, but their exact file/config behavior needs authenticated smoke coverage.
- The CLI-only stream path is process-per-turn prompt mode, so Vibe Forge should avoid promising long-lived SDK hook callback semantics.
- Keeping hook plugins on the shared task bridge preserves current behavior without introducing another hook execution path.

Future work can add a Copilot-native hook bridge for direct mode after validating `sessionStart`, `userPromptSubmitted`, `preToolUse`, `postToolUse`, `permissionRequest`, and stop events against the real CLI.

## Detailed Design

### Package Layout

```text
packages/adapters/copilot/
  package.json
  src/
    adapter-config.ts
    icon.ts
    index.ts
    models.ts
    paths.ts
    schema.ts
    runtime/
      init.ts
      session.ts
      shared.ts
      session/
        direct.ts
        stream.ts
```

### CLI Args

Common args:

- `--resume <session-id>`
- `--no-auto-update`
- `--no-remote`
- `--config-dir <managed-dir>`
- optional `--model <resolved-model>`
- optional `--effort <low|medium|high|xhigh>`
- optional `--agent <name>`
- optional MCP, tool, and permission flags

Stream args add:

- `--prompt <prompt>`
- `--output-format json`
- `--stream on|off`

Direct args add:

- `--interactive <prompt>` when an initial prompt exists

### JSONL Event Mapping

| Copilot JSONL event       | Vibe Forge event        |
| ------------------------- | ----------------------- |
| `assistant.message_delta` | buffered assistant text |
| `assistant.message`       | `message`               |
| `tool.execution_start`    | tool-use `message`      |
| `tool.execution_complete` | tool-result `message`   |
| `session.error`           | `error`                 |
| process exit 0            | `stop` after the turn   |
| process exit non-zero     | `error` + `exit`        |

If Copilot emits plain text despite JSON mode, the adapter falls back to one assistant message from raw stdout lines.

## Testing

Unit coverage:

- stream runtime builds Copilot prompt-mode args and emits message / stop;
- stream runtime does not spawn until the first message when created without description;
- stream runtime maps permission bypass to `--allow-all`;
- stream runtime stages system prompt and selected skills into managed Copilot paths;
- stream runtime maps `modelServices` to Copilot provider env and resolved `--model`;
- provider proxy forwards routed provider requests and records request / response lifecycle;
- stream runtime emits error / exit for process failures;
- direct runtime starts Copilot interactive mode with inherited stdio;
- asset plan classifies Copilot MCP, skills, hook plugins, and unsupported overlays correctly.

Verification commands:

```bash
pnpm exec vitest run packages/adapters/copilot/__tests__
pnpm exec vitest run packages/workspace-assets/__tests__/adapter-asset-plan.spec.ts
pnpm typebuild
```

Real smoke checks require a locally installed and authenticated Copilot CLI:

```bash
npx vf run --adapter copilot --print "hello"
npx vf run --adapter copilot --print --include-skill research "use the research skill"
npx vf run --adapter copilot "open interactive mode"
```

## Rollout

1. Land package, registration, model metadata, icon metadata, and shared type changes.
2. Land CLI-only direct and stream runtime.
3. Land system prompt, skill, MCP, permission, provider env mapping, and routed provider proxy observability.
4. Add real Copilot CLI smoke coverage on an authenticated machine.
5. Revisit native Copilot hooks, plugin support, and SDK usage after CLI behavior is stable.

## Open Questions

- Which Copilot JSONL events should be surfaced as first-class UI tool progress instead of generic tool messages?
- Should strict isolation disable repository-native Copilot instructions and hooks by default, or only when adapter config opts in?
- Should routed provider proxy observability get an adapter config opt-out for local-only providers?
- Which Copilot permission patterns are stable enough to compile Vibe Forge allow/deny rules directly?
