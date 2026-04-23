---
parent_rfc: 0003
title: Implementation Plan for Dynamic Adapter Catalog and Tool Host Protocol
status: draft
author: Codex
created: 2026-04-16
updated: 2026-04-16
---

# Implementation Plan for RFC 0003

## Summary

This document translates RFC 0003 into an executable rollout plan.

The first milestone is intentionally narrow:

- keep raw `tool_use` / `tool_result` as-is;
- do not add live process hosts yet;
- do not remove client-local tool rendering yet;
- first extract adapter metadata into a server-generated catalog;
- first add server-generated tool presentation for static summaries and artifacts;
- let the client consume the new data with fallback to existing behavior.

This ordering removes the biggest architectural coupling without forcing an all-at-once UI rewrite.

## Phase Structure

### Phase 1

Deliver the shared contracts and server endpoints needed for:

- dynamic adapter catalog;
- static tool view envelopes;
- client fallback consumption.

### Phase 2

Migrate existing generic and Claude-specific tool builders out of the client.

### Phase 3

Cut over the client to server-derived tool views by default and remove direct adapter metadata dependencies.

### Phase 4

Add host resource bindings for live process and terminal-like surfaces.

This implementation plan only specifies Phase 1 in detail.

## Phase 1 Scope

### In Scope

- add shared types for adapter catalog and tool view envelopes;
- add a server-side adapter manifest loader;
- add a server-generated adapter catalog endpoint;
- stop treating adapter builtin models as merged config source data;
- add a server-side tool presentation service for static card-like and artifact-like views;
- expose tool view data in session history and websocket updates;
- add client-side read-path support for catalog and tool views;
- preserve all existing client renderers as fallback.

### Out of Scope

- live process and terminal host bindings;
- browser-side dynamic UI loading;
- database schema changes for persisted tool views;
- removing the current `GenericClaudeTool` and generic presentation code in Phase 1;
- converting every adapter package to the new exports immediately.

## Phase 1 Deliverables

1. shared type contracts in `packages/types`
2. server-side adapter catalog service and endpoint
3. server-side tool presentation service
4. websocket and session history support for tool view updates
5. client catalog consumption with fallback
6. client tool view consumption with fallback
7. focused tests for contract derivation and endpoint behavior

## Contract Changes

### 1. Adapter Config Contract

Extend the config contract so adapter entries may resolve to runtime packages explicitly.

Target file:

- [packages/types/src/config.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/config.ts)

Phase 1 shape:

```ts
export interface AdapterInstanceConfig extends AdapterConfigCommon {
  packageId?: string
  [key: string]: unknown
}

export type AdapterConfigMap = Record<string, AdapterInstanceConfig>

export interface Config {
  adapters?: AdapterConfigMap
  defaultAdapter?: string
}
```

Notes:

- the config map key is the adapter instance id, not the package id;
- `packageId` is optional for compatibility with current built-in naming;
- existing keys like `codex`, `claude-code`, `gemini` remain valid as instance ids;
- runtime resolution continues to fall back to the current naming convention when `packageId` is absent;
- `AdapterMap` no longer defines raw config keys and instead remains the package-scoped schema registry used after adapter package resolution.

### 2. Adapter Catalog Contract

Add new catalog types to `packages/types`.

Suggested file:

- `packages/types/src/adapter-catalog.ts`

Export through:

- [packages/types/src/index.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/index.ts)

Phase 1 contract:

```ts
export interface AdapterCatalogCapabilities {
  supportsEffort?: boolean
  supportsDirectRuntime?: boolean
  supportsSessionTerminal?: boolean
  supportsLiveToolProcess?: boolean
  supportsPermissionMirror?: boolean
  hookMode?: 'none' | 'task-bridge' | 'native'
  projectSkillsMode?: 'none' | 'prompt' | 'overlay' | 'native'
}

export interface AdapterCatalogEntry {
  instanceId: string
  packageId: string
  title: string
  icon?: string
  builtinModels: AdapterBuiltinModel[]
  capabilities: AdapterCatalogCapabilities
}

export interface AdapterCatalogResponse {
  adapters: AdapterCatalogEntry[]
}
```

### 3. Tool View Contract

Add new tool presentation types to `packages/types`.

Suggested file:

- `packages/types/src/tool-view.ts`

Export through:

- [packages/types/src/index.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/index.ts)

Phase 1 contract should stay static-only:

```ts
export interface ToolViewBadge {
  label: string
  tone?: 'default' | 'warning' | 'error'
}

export interface ToolViewSummary {
  title: string
  icon?: string
  primary?: string
  status?: 'pending' | 'running' | 'success' | 'error'
  badges?: ToolViewBadge[]
}

export interface ToolViewField {
  label: string
  value: unknown
  format?: 'inline' | 'code' | 'json' | 'list'
}

export type ToolViewArtifact =
  | { id: string; kind: 'text'; value: string }
  | { id: string; kind: 'markdown'; value: string }
  | { id: string; kind: 'code'; value: string; language?: string }
  | { id: string; kind: 'json'; value: unknown }
  | { id: string; kind: 'diff'; original: string; modified: string; language?: string }
  | { id: string; kind: 'list'; items: string[] }
  | { id: string; kind: 'image'; src: string; alt?: string; title?: string }

export type ToolViewSection =
  | { type: 'fields'; fields: ToolViewField[] }
  | { type: 'artifact'; artifactId: string; display: 'text' | 'markdown' | 'code' | 'json' | 'diff' | 'list' | 'image' }
  | { type: 'notice'; tone?: 'default' | 'warning' | 'error'; text: string }

export interface ToolView {
  defaultExpanded?: boolean
  sections: ToolViewSection[]
}

export interface ToolViewEnvelope {
  version: 1
  toolViewId: string
  sourceMessageId: string
  toolUseId: string
  revision: number
  summary: ToolViewSummary
  call?: ToolView
  result?: ToolView
  artifacts?: ToolViewArtifact[]
  textFallback: string
}
```

`toolViewId` is a deterministic session-local cache key. Phase 1 can derive it as `${sourceMessageId}:${toolUseId}`.

Phase 1 deliberately excludes host bindings. Those arrive in Phase 4.

### 4. Websocket and Session Response Contracts

Target files:

- [packages/types/src/websocket.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/websocket.ts)
- [apps/client/src/api/types.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/api/types.ts)

Add:

```ts
| { type: 'tool_view'; view: ToolViewEnvelope }
```

For session history responses, add:

```ts
toolViews?: Record<string, ToolViewEnvelope>
```

Keyed by `toolViewId`.

## Server Changes

### 1. Adapter Manifest Loader

Target files:

- [packages/types/src/adapter-package.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/adapter-package.ts)
- new `packages/types/src/adapter-manifest.ts`

Add loader helpers parallel to `loadAdapter()`:

- `resolveAdapterPackageNameForConfigEntry()`
- `loadAdapterManifest()`
- `loadAdapterPresentationProviders()`

Phase 1 fallback behavior:

- if `./manifest` is absent, synthesize a default manifest from known runtime traits where possible;
- if `./presentation` is absent, only generic fallback providers run.

### 2. Adapter Catalog Service

Add a dedicated server service instead of continuing to derive metadata inside config route logic.

Suggested new file:

- `apps/server/src/services/config/adapter-catalog.ts`

Responsibilities:

- read merged adapter config from `loadConfigState()`;
- resolve `instanceId -> packageId`;
- load manifest and builtin models;
- produce `AdapterCatalogEntry[]`.

### 3. Config Route Cleanup

Target file:

- [apps/server/src/routes/config.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/server/src/routes/config.ts)

Phase 1 changes:

- stop putting `adapterBuiltinModels` under `sources.*.merged`;
- keep `sources.*` for authored config only;
- add a separate metadata block:

```ts
meta: {
  ...
  adapterCatalog?: AdapterCatalogEntry[]
}
```

If keeping a dedicated endpoint is cleaner, prefer:

- `GET /api/runtime/adapter-catalog`

Recommendation:

- add the dedicated endpoint now;
- keep `meta.adapterCatalog` out of `/api/config`;
- leave `/api/config` focused on config sources.

### 4. Tool Presentation Service

Suggested new server files:

- `apps/server/src/services/session/tool-view.ts`
- `apps/server/src/services/session/tool-view-registry.ts`

Registry responsibilities:

- combine shared generic providers and adapter-local providers;
- select the first matching provider for a tool call;
- build a `ToolViewEnvelope`.

Phase 1 provider order:

1. built-in shared generic provider
2. adapter-local providers from `./presentation`
3. generic fallback summary provider

### 5. Generic Provider Extraction

Current logic lives in the client:

- [apps/client/src/components/chat/tools/core/generic-tool-presentation.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/components/chat/tools/core/generic-tool-presentation.ts)
- [apps/client/src/components/chat/tools/core/tool-summary.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/components/chat/tools/core/tool-summary.ts)

Phase 1 does not remove these files yet.

Instead:

- create a dedicated shared package under `packages/tool-view/` so presentation logic stays out of `packages/core`.

Suggested files:

- `packages/tool-view/src/build-generic-tool-view.ts`
- `packages/tool-view/src/tool-view-summary.ts`
- `packages/tool-view/src/index.ts`

This shared logic should be pure and browser-free so server, CLI, and future channel renderers can reuse it.

### 6. Session History Response

Target file:

- [apps/server/src/routes/sessions.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/server/src/routes/sessions.ts)

For `GET /api/sessions/:id/messages`:

- keep existing `messages`, `session`, `interaction`, `queuedMessages`;
- add `toolViews`, derived on read from current message history.

This avoids a DB migration in Phase 1.

### 7. Websocket Broadcast

Target files:

- `apps/server/src/services/session/events.ts`
- `apps/server/src/services/session/runtime.ts`
- possibly `apps/server/src/services/session/index.ts`

Behavior:

- whenever a tool-use or tool-result event changes the current tool state, compute the corresponding `ToolViewEnvelope`;
- broadcast a `tool_view` websocket event;
- do not require clients to reconstruct the envelope locally.

## Client Changes

### 1. Adapter Catalog Consumption

Current adapter display code is static:

- [apps/client/src/resources/adapters.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/resources/adapters.ts)

Phase 1 path:

- keep `resources/adapters.ts` as fallback for now;
- add a new client hook:
  - `apps/client/src/hooks/use-adapter-catalog.ts`
- prefer runtime catalog entries when available;
- fall back to `getAdapterDisplay()` when catalog data is absent.

Update consumers:

- [apps/client/src/hooks/chat/use-chat-adapter.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/hooks/chat/use-chat-adapter.ts)
- [apps/client/src/hooks/chat/use-chat-model-adapter-selection.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/hooks/chat/use-chat-model-adapter-selection.tsx)
- [apps/client/src/components/Sidebar.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/components/Sidebar.tsx)
- `apps/client/src/components/sidebar/SessionItem.tsx`

### 2. Model Selection Input Source

Current model selection reads `adapterBuiltinModels` from `config.sources.merged`.

Phase 1 change:

- read builtin models from adapter catalog instead;
- leave legacy fallback to `config.sources.merged.adapterBuiltinModels` only during migration if needed.

Target files:

- [apps/client/src/hooks/chat/model-selector.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/hooks/chat/model-selector.ts)
- [apps/client/src/hooks/chat/use-chat-models.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/hooks/chat/use-chat-models.tsx)
- [apps/client/src/hooks/chat/use-chat-model-adapter-selection.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/hooks/chat/use-chat-model-adapter-selection.tsx)

### 3. Tool View State

Add a client-side tool view cache keyed by `toolViewId`.

Suggested file:

- `apps/client/src/hooks/chat/tool-view-cache.ts`

Responsibilities:

- seed from `GET /api/sessions/:id/messages`;
- update from websocket `tool_view` events;
- expose lookup by `toolViewId`;
- expose a helper to derive `toolViewId` from `{ sourceMessageId, toolUseId }` when the renderer starts from raw message content.

### 4. Tool Renderer Fallback Path

Target files:

- [apps/client/src/components/chat/tools/core/ToolRenderer.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/components/chat/tools/core/ToolRenderer.tsx)
- [apps/client/src/components/chat/tools/DefaultTool.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/components/chat/tools/DefaultTool.tsx)

Phase 1 behavior:

- if `ToolViewEnvelope` exists for the current `{ sourceMessageId, toolUseId }`, render it through a new generic host renderer;
- otherwise keep current behavior.

Suggested new files:

- `apps/client/src/components/chat/tools/core/ToolViewRenderer.tsx`
- `apps/client/src/components/chat/tools/core/tool-view-artifact-renderers.tsx`

Do not remove:

- [apps/client/src/components/chat/tools/adapter-claude/index.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/components/chat/tools/adapter-claude/index.ts)
- current client-local generic tool builders

Those stay as fallback until Phase 2 and Phase 3.

## Endpoint Plan

### 1. Adapter Catalog Endpoint

Add:

- `GET /api/runtime/adapter-catalog`

Response:

```ts
AdapterCatalogResponse
```

Why separate:

- avoids polluting `/api/config` with runtime-derived data;
- keeps config source semantics clean;
- can later add non-config-derived adapter metadata without reshaping config payloads.

### 2. Session Messages Endpoint

Keep:

- `GET /api/sessions/:id/messages`

Extend response:

```ts
{
  messages,
  session,
  interaction,
  queuedMessages,
  toolViews
}
```

### 3. Websocket

Add new event:

```ts
{ type: 'tool_view', view: ToolViewEnvelope }
```

Phase 1 only sends static envelopes. No live host resources yet.

## Test Plan

### Shared Type and Loader Tests

- `packages/types/__tests__/adapter-package.spec.ts`
- new tests for manifest and presentation provider loading

### Server Tests

Add:

- `apps/server/__tests__/routes/config-runtime.spec.ts` or similar for adapter catalog endpoint
- `apps/server/__tests__/services/session-tool-view.spec.ts`
- session messages response coverage for `toolViews`
- websocket event coverage for `tool_view`

### Client Tests

Add:

- hook tests for adapter catalog fallback behavior
- tool view cache tests
- renderer tests covering:
  - server-provided view path
  - fallback to existing local renderers

Do not delete current generic and Claude presentation tests in Phase 1. They still protect fallback behavior.

## Migration Notes

### Adapter Packages

Phase 1 does not require every adapter to add `./manifest` and `./presentation` immediately.

Initial adoption order:

1. `claude-code`
2. `codex`
3. `copilot`
4. `gemini`
5. `kimi`
6. `opencode`

The server loader must tolerate missing exports during rollout.

### Client Bundle Risk

Phase 1 should not remove any existing client renderer path yet. This keeps regression risk low while server-derived views are still proving out.

### Data Persistence

Phase 1 derives tool views from message history on demand. If later performance or determinism requires caching, that can be added after the contract stabilizes.

## Exit Criteria for Phase 1

Phase 1 is complete when all of the following are true:

- the client can render adapter labels and builtin models from runtime catalog data;
- the client can consume server-derived `tool_view` data when present;
- the current chat view still works when `tool_view` is absent;
- `apps/client` can begin removing direct adapter metadata imports in the next phase;
- no DB migration is required to adopt the new protocol.

## Phase 1 PR Breakdown

Phase 1 should be delivered as three reviewable PRs.

The boundary rule is:

- PR 1 finishes adapter catalog end to end;
- PR 2 finishes server-side static tool view production and read APIs;
- PR 3 finishes client consumption and live updates.

### PR 1: Adapter Catalog Foundation

Goal:

- introduce explicit adapter package resolution;
- introduce adapter catalog contracts;
- expose runtime adapter catalog to the client;
- move model-selector adapter metadata away from static browser imports.

Primary files:

- [packages/types/src/config.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/config.ts)
- [packages/types/src/adapter-package.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/adapter-package.ts)
- `packages/types/src/adapter-catalog.ts`
- `packages/types/src/adapter-manifest.ts`
- [packages/types/src/index.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/index.ts)
- `apps/server/src/services/config/adapter-catalog.ts`
- new `apps/server/src/routes/runtime.ts` or equivalent route file
- [apps/client/src/hooks/chat/use-chat-adapter.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/hooks/chat/use-chat-adapter.ts)
- [apps/client/src/hooks/chat/use-chat-model-adapter-selection.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/hooks/chat/use-chat-model-adapter-selection.tsx)
- [apps/client/src/hooks/chat/use-chat-models.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/hooks/chat/use-chat-models.tsx)
- [apps/client/src/components/Sidebar.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/components/Sidebar.tsx)
- `apps/client/src/components/sidebar/SessionItem.tsx`
- `apps/client/src/hooks/use-adapter-catalog.ts`

API additions:

- `GET /api/runtime/adapter-catalog`

Acceptance criteria:

- adapter select labels and icons can come from runtime catalog;
- model selector builtin models can come from runtime catalog;
- client still falls back to `apps/client/src/resources/adapters.ts` when catalog data is missing;
- `/api/config` no longer needs to be the source of `adapterBuiltinModels` for the new path.

Not in scope:

- `tool_view`
- websocket changes
- tool renderer changes

### PR 2: Server-Side Static Tool View

Goal:

- introduce tool view contracts;
- extract a server-side generic tool view builder;
- expose static `toolViews` on session history reads.

Primary files:

- `packages/types/src/tool-view.ts`
- [packages/types/src/websocket.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/websocket.ts)
- [packages/types/src/index.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/packages/types/src/index.ts)
- `packages/tool-view/src/build-generic-tool-view.ts`
- `packages/tool-view/src/tool-view-summary.ts`
- `packages/tool-view/src/index.ts`
- `apps/server/src/services/session/tool-view.ts`
- `apps/server/src/services/session/tool-view-registry.ts`
- [apps/server/src/routes/sessions.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/server/src/routes/sessions.ts)
- [apps/client/src/api/types.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/api/types.ts)

API additions:

- `GET /api/sessions/:id/messages` returns `toolViews`

Acceptance criteria:

- server can derive `ToolViewEnvelope` from existing raw message history without DB migration;
- history response includes `toolViews` keyed by `toolViewId`;
- current clients can ignore `toolViews` without regression;
- shared generic tool view builder has unit coverage for diff-like, list-like, and shell-like tool payloads.

Not in scope:

- client rendering switch
- websocket `tool_view`
- live process or host bindings

### PR 3: Client Tool View Consumption and Live Updates

Goal:

- teach the client to consume server-derived tool views first;
- preserve current local renderers as fallback;
- add websocket delivery for incremental updates.

Primary files:

- `apps/client/src/hooks/chat/tool-view-cache.ts`
- [apps/client/src/hooks/chat/use-chat-session-messages.ts](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/hooks/chat/use-chat-session-messages.ts)
- [apps/client/src/components/chat/tools/core/ToolRenderer.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/components/chat/tools/core/ToolRenderer.tsx)
- [apps/client/src/components/chat/tools/DefaultTool.tsx](/Users/yijie/.codex/worktrees/1ed9/vibe-forge.ai/apps/client/src/components/chat/tools/DefaultTool.tsx)
- `apps/client/src/components/chat/tools/core/ToolViewRenderer.tsx`
- `apps/client/src/components/chat/tools/core/tool-view-artifact-renderers.tsx`
- `apps/server/src/services/session/events.ts`
- `apps/server/src/services/session/runtime.ts`
- `apps/server/src/services/session/index.ts`

API additions:

- websocket event: `{ type: 'tool_view', view: ToolViewEnvelope }`

Acceptance criteria:

- chat history hydrates `toolViews` from session messages response;
- live sessions receive and apply `tool_view` websocket updates;
- when `tool_view` exists, the client renders it through `ToolViewRenderer`;
- when `tool_view` is absent, current local rendering still works unchanged;
- no adapter package browser code is newly introduced.

Not in scope:

- removing `adapter-claude` client renderers
- removing `generic-tool-presentation.ts`
- live process resources

## Suggested Merge Order

1. merge PR 1 first, because PR 2 and PR 3 both benefit from adapter package resolution and catalog loading utilities;
2. merge PR 2 second, because it adds server-produced `toolViews` without forcing an immediate client cutover;
3. merge PR 3 last, because it changes the visible chat rendering path and depends on PR 2 contracts being stable.

## Optional Split If Review Size Is Still Too Large

If PR 1 becomes too broad, split it into:

- PR 1a: shared adapter catalog contracts and server endpoint
- PR 1b: client catalog consumption and model-selector fallback

If PR 3 becomes too risky, split it into:

- PR 3a: history-read cache and `ToolViewRenderer`
- PR 3b: websocket `tool_view` broadcasting

The preferred path is still 3 PRs unless review pressure forces a smaller batch size.
