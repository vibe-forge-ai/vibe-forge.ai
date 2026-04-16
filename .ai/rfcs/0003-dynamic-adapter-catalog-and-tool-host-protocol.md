---
rfc: 0003
title: Dynamic Adapter Catalog and Tool Host Protocol
status: draft
author: Codex
created: 2026-04-16
updated: 2026-04-16
---

# Dynamic Adapter Catalog and Tool Host Protocol

## Summary

Decouple `apps/client` from concrete adapter packages and move adapter-specific tool presentation out of the browser bundle.

This RFC introduces four related changes:

1. dynamic adapter instances in config, where the config key is an instance id and the package is resolved from `packageId` or naming convention;
2. an adapter catalog, generated on the server from adapter package manifests and current config, instead of static imports in `apps/client`;
3. a tool presentation protocol, computed on the server or shared Node-side packages, that turns raw `tool_use` / `tool_result` events into versioned view models;
4. a host capability model in the client, where the browser owns a small allowlist of surfaces such as inline cards, diff viewers, dock panels, terminal hosts, side panels, and route jumps.

The source of truth remains raw adapter events and stored message history. Presentation is derived data, versioned, replaceable, and never required for correctness.

## Motivation

The current model mixes three different concerns:

- adapter runtime translation;
- adapter metadata for selection and capability display;
- adapter-specific browser rendering.

That coupling currently leaks into `apps/client` in several places:

- static adapter metadata imports and package dependencies;
- adapter-specific tool render branches in the client bundle;
- capability checks duplicated across task runtime, server, and client;
- special-case UI such as terminal dock behavior living outside the tool rendering contract.

This makes every new adapter expensive:

- add a runtime package;
- add browser dependencies;
- add display metadata to the client;
- add tool-specific rendering logic to the client;
- update multiple hardcoded capability lists.

It also breaks the intended layering: `apps/client` should consume shared contracts and rendered metadata, not know how to load or interpret adapter packages.

## Current Problems

### 1. Client package dependencies are adapter-shaped

Today the client directly depends on multiple adapter packages for icon and display metadata, and also imports adapter schema modules only to support tool-specific typing.

That means:

- adding or renaming an adapter changes the browser dependency graph;
- adapter packages become part of the web bundle contract;
- browser rendering cannot evolve independently from adapter runtime packages.

### 2. Tool rendering is hardcoded in the browser

The client currently decides:

- which tool names are special;
- which fields are important;
- which results should become diff views;
- which tool names should be grouped or summarized together.

This is workable for a few known adapters, but it does not scale to user-configured adapters or private adapter packages.

### 3. Some tool surfaces are not “cards”

`bash` is the clearest example, but not the only one. A tool might need:

- a static summary card;
- a diff viewer;
- a large code artifact;
- an image viewer;
- a live process surface;
- a dock panel;
- a route jump into a dedicated page;
- an out-of-band user interaction flow.

A pure “JSON fields to card sections” model is too weak for these cases.

### 4. Derived adapter data is mixed into config responses

The existing config route already derives adapter builtin models dynamically. That pattern is useful, but the data currently lives inside the merged config payload, even though it is not user-authored config.

Longer-term, config sources and runtime-derived catalog data should be separated.

### 5. Capability knowledge is duplicated

The codebase currently uses hardcoded adapter lists for concerns such as:

- effort support;
- native project skills;
- permission mirror behavior;
- tool presentation rules;
- session terminal behavior.

Those lists should come from adapter manifests or shared capability contracts instead of being maintained in multiple apps and packages.

## Goals

- let users configure adapter instances without forcing the client to statically depend on every adapter package;
- keep raw message events and stored history as the source of truth;
- move adapter-specific tool presentation to the server or shared Node-side packages;
- support both static and stateful tool surfaces, including live process and terminal-like views;
- ensure web, CLI, and channel clients can share the same derived summary logic;
- keep the browser host strict and allowlisted instead of loading arbitrary adapter UI code;
- support incremental migration from existing client-local tool builders.

## Non-Goals

- do not load arbitrary React components from adapter packages in the browser;
- do not make rendered presentation the primary persisted source of truth;
- do not require all adapters to support live process or terminal hosts;
- do not merge `interaction_request` into tool rendering;
- do not fully redesign asset planning in this RFC, even though some capability fields will help future work;
- do not block existing raw message consumers while the new protocol rolls out.

## Design Overview

The proposal separates the problem into four layers:

### 1. Raw Runtime Layer

Adapters keep emitting normalized raw events:

- `message` with `tool_use` / `tool_result`;
- `interaction_request`;
- session and adapter events;
- optional live runtime handles.

This layer stays adapter- and transport-facing.

### 2. Presentation Layer

The server resolves a presentation provider for each tool call and computes a versioned `ToolViewEnvelope`.

The provider may use:

- `tool_use`;
- `tool_result`;
- session adapter metadata;
- current runtime state;
- optional live resource handles.

The provider never returns browser code. It only returns declarative view data plus references to host capabilities.

### 3. Host Capability Layer

The web client owns a fixed allowlist of host surfaces:

- inline tool card;
- code / markdown / JSON blocks;
- diff viewer;
- image viewer;
- table / tree viewer;
- dock panel;
- terminal-like live output host;
- side panel or modal;
- route jump.

Adapters can request these capabilities through declarative bindings. They cannot ship arbitrary new browser surfaces through runtime packages.

### 4. Client Extension Layer

If Vibe Forge later needs a truly new browser surface, that should be handled by a separate client plugin or host extension mechanism, not by adapter packages.

Adapter packages may influence runtime behavior and derived presentation, but they do not get to inject browser code.

## Adapter Instance Model

The config key under `adapters` becomes an instance id, not a hardcoded package identity.

Example:

```yaml
adapters:
  primary:
    packageId: "@vibe-forge/adapter-codex"
    defaultModel: "gpt-5.4"

  review:
    packageId: "@acme/vf-adapter-review"
    defaultModel: "review-v1"

defaultAdapter: primary
```

Rules:

- the map key is the adapter instance id used by session selection and `defaultAdapter`;
- `packageId` is optional for built-in adapters and falls back to the existing package resolution convention;
- legacy config such as `adapters.codex` remains valid and resolves to `@vibe-forge/adapter-codex`;
- runtime schema validation happens after resolving the adapter package for the selected instance.

Shared typing implications:

- `Config['adapters']` becomes `Record<string, AdapterInstanceConfig>`;
- `Config['defaultAdapter']` becomes `string`;
- `AdapterMap` no longer defines raw config keys and instead remains the package-scoped schema registry used after `packageId` resolution;
- legacy built-in keys still resolve through the current naming convention when `packageId` is absent.

This lets users define multiple instances of the same runtime package without teaching the browser about each package.

## Adapter Package Exports

Adapters keep their current runtime export and gain two optional exports:

- `./manifest`
- `./presentation`

### `./manifest`

`./manifest` is static metadata and capability declaration:

```ts
interface AdapterManifest {
  packageId: string
  title: string
  icon?: string
  builtinModels?: AdapterBuiltinModel[]
  capabilities: {
    supportsEffort?: boolean
    supportsDirectRuntime?: boolean
    supportsSessionTerminal?: boolean
    supportsLiveToolProcess?: boolean
    projectSkillsMode?: 'none' | 'prompt' | 'overlay' | 'native'
    hookMode?: 'none' | 'task-bridge' | 'native'
    supportsPermissionMirror?: boolean
  }
  toolNamespaces?: string[]
}
```

This is the source for adapter catalog generation and for shared capability checks that are currently hardcoded in multiple places.

### `./presentation`

`./presentation` exports one or more presentation providers:

```ts
interface ToolPresentationProvider {
  matches(input: ToolPresentationInput): boolean
  build(input: ToolPresentationInput): ToolViewEnvelope | undefined
}
```

This export is Node-side only. It can use adapter-local helper code and tool schemas, but it is never bundled into the browser.

## Adapter Catalog

The server generates an adapter catalog by combining:

- current `config.adapters`;
- resolved package ids;
- adapter manifests;
- derived builtin models.

Suggested response shape:

```ts
interface AdapterCatalogEntry {
  instanceId: string
  packageId: string
  title: string
  icon?: string
  builtinModels?: AdapterBuiltinModel[]
  capabilities: AdapterManifest['capabilities']
}
```

The catalog should be served from a dedicated runtime endpoint or a clearly separated metadata block, not merged into the config source tree.

The client uses this catalog for:

- adapter selection labels and icons;
- model selection capabilities;
- effort support;
- future display and diagnostics.

This lets `apps/client` drop direct adapter package dependencies.

## Tool Presentation Protocol

Presentation is derived out-of-band data keyed by a stable server-derived tool view id, not by the raw adapter tool id alone.

Instead of mutating stored `tool_use` / `tool_result` content, the server emits a separate tool view stream:

```ts
interface ToolViewEnvelope {
  version: 1
  toolViewId: string
  sourceMessageId: string
  toolUseId: string
  revision: number
  summary: {
    title: string
    icon?: string
    primary?: string
    status?: 'pending' | 'running' | 'success' | 'error'
    badges?: Array<{ label: string; tone?: 'default' | 'warning' | 'error' }>
  }
  call?: ToolView
  result?: ToolView
  artifacts?: ToolArtifact[]
  hosts?: ToolHostBinding[]
  textFallback: string
}
```

`toolViewId` must be deterministic within a session. Phase 1 can derive it as `${sourceMessageId}:${toolUseId}` so history reads and websocket updates converge on the same cache key.

`ToolView` is a declarative layout description:

```ts
interface ToolView {
  defaultExpanded?: boolean
  sections: ToolSection[]
}

type ToolSection =
  | { type: 'fields'; fields: ToolField[] }
  | { type: 'markdown'; artifactId: string }
  | { type: 'code'; artifactId: string }
  | { type: 'json'; artifactId: string }
  | { type: 'diff'; artifactId: string }
  | { type: 'list'; artifactId: string }
  | { type: 'image'; artifactId: string }
  | { type: 'notice'; tone?: 'default' | 'warning' | 'error'; text: string }
```

The important boundary is this:

- providers build view models;
- clients render view models;
- raw tool content still exists independently.

## Artifact Model

Artifacts carry presentation payloads that are larger or more structured than a field list.

```ts
type ToolArtifact =
  | { id: string; kind: 'text'; value: string }
  | { id: string; kind: 'markdown'; value: string }
  | { id: string; kind: 'code'; value: string; language?: string }
  | { id: string; kind: 'json'; value: unknown }
  | { id: string; kind: 'diff'; original: string; modified: string; language?: string }
  | { id: string; kind: 'image'; src: string; alt?: string; title?: string }
  | { id: string; kind: 'table'; columns: string[]; rows: unknown[][] }
  | { id: string; kind: 'tree'; nodes: unknown[] }
```

Artifacts may be inline in the view envelope or replaced by future resource references if payload size becomes a transport problem.

## Host Capability Model

Some tools need more than inline sections. For those cases, the provider may emit host bindings.

```ts
type ToolHostBinding =
  | {
    id: string
    host: 'dock-panel'
    capability: 'terminal'
    activation: 'manual' | 'auto'
    label: string
    resource: HostResourceHandle
  }
  | {
    id: string
    host: 'side-panel' | 'modal'
    capability: 'artifact-viewer'
    activation: 'manual'
    label: string
    artifactId: string
  }
  | {
    id: string
    host: 'route'
    capability: 'route-link'
    activation: 'manual'
    label: string
    route: string
  }
```

`HostResourceHandle` is a server-issued, session-scoped reference:

```ts
type HostResourceHandle =
  | { kind: 'session-terminal'; sessionId: string }
  | { kind: 'tool-process'; processId: string }
  | { kind: 'artifact'; artifactId: string }
```

The client only understands allowlisted host kinds. Unknown bindings are ignored and replaced by `textFallback`.

## Scenario Coverage

### Static Read / Write / Search Tools

These tools usually need:

- summary text;
- selected inline fields;
- code, markdown, JSON, or list artifacts.

No special host capability is required.

### Edit / Apply Patch / File Change Tools

These tools usually need:

- summary text;
- file target metadata;
- diff artifact;
- optional side-panel diff host for large patches.

The diff viewer is a client host capability, not adapter-owned UI code.

### Bash / Exec / Shell Tools

These tools have three valid presentation levels:

1. minimal: summary plus stdout/stderr artifact;
2. rich static: summary, command details, stdout/stderr artifacts, exit status badges;
3. rich live: summary plus a `terminal` host binding to a live process resource.

Not every runtime can provide level 3. The contract must support it, but not require it.

This keeps the design honest:

- a tool can be shell-shaped without requiring a terminal host;
- a runtime can expose a live process when it truly has one;
- the web client can reuse the existing dock panel and terminal host for this capability.

### Session-Level Direct Runtime

Direct runtime terminal ownership is not a tool renderer concern. It remains a session capability.

The same host model still applies:

- a session may expose a `session-terminal` resource;
- the chat route may open it in the dock panel;
- this behavior stays outside `tool_use` rendering.

### Ask User Question / Permission Requests

These remain on the dedicated `interaction_request` protocol.

The tool view may surface a “waiting for input” summary if useful, but it must not replace or absorb the interaction contract.

### Images, Browser Artifacts, and Rich Media

Tools that produce screenshots, previews, or browser capture data use artifacts plus image or modal hosts. This keeps media handling unified even when the producing runtime differs.

### Tasks, Benchmarks, and Dedicated Pages

Some tools are better represented as route jumps than oversized message cards.

For those cases the provider emits:

- a concise summary;
- an optional route host binding to a dedicated page or panel.

## Server Responsibilities

The server becomes the composition point for adapter-derived UI metadata.

Responsibilities:

- resolve adapter instance id to package id;
- load adapter manifests and build the adapter catalog;
- resolve and run tool presentation providers;
- emit `tool_view` updates keyed by `toolViewId`;
- reconstruct current tool views on history reads without changing stored raw messages;
- issue scoped host resource handles for live surfaces;
- provide fallback summaries for clients that do not support host bindings.

The server may cache derived tool views, but raw events remain the source of truth and cache invalidation must be safe to lose.

## Client Responsibilities

The client becomes a host, not an adapter registry.

Responsibilities:

- fetch and display adapter catalog entries;
- render `ToolViewEnvelope` using built-in host components;
- keep a local allowlist of supported host capabilities;
- ignore unknown section or host kinds without breaking the chat view;
- fall back to `textFallback` or existing generic rendering while migration is in progress.

The client no longer needs:

- direct adapter metadata imports;
- adapter package dependencies for display;
- adapter-local tool rendering rules.

## CLI and Channel Behavior

Web is not the only consumer.

The same server-side presentation service should also provide:

- a plain summary string for CLI print mode;
- a channel-safe summary or structured block fallback for chat integrations;
- stable grouping keys for tool summary aggregation.

Every view envelope therefore requires `textFallback`, even when rich hosts are present.

## Compatibility and Migration

Migration should be incremental.

### Phase 1

- add adapter manifest and tool presentation provider loaders;
- add a dedicated adapter catalog endpoint;
- keep existing client-local rendering as fallback.

### Phase 2

- introduce `tool_view` updates in websocket and history responses;
- extract current generic tool presentation into a shared Node-side provider;
- migrate Claude-specific presentation out of the client.

### Phase 3

- switch the web client to prefer `tool_view`;
- migrate hardcoded capability checks to adapter manifest capabilities;
- remove direct adapter metadata dependencies from `apps/client`.

### Phase 4

- add optional live process host resources for runtimes that can support them;
- evaluate whether some existing route-specific views should become host bindings.

Backward compatibility rules:

- raw `tool_use` / `tool_result` remains available;
- clients that do not understand `tool_view` continue to work;
- legacy adapter config without `packageId` continues to resolve through the existing naming convention.

## Security and Stability

This RFC deliberately avoids browser-side dynamic adapter execution.

Security and stability rules:

- adapter packages may not ship arbitrary browser components;
- host capability names are allowlisted by the client;
- live resource handles are server-issued, session-scoped, and revocable;
- unknown view sections or host bindings degrade to summary text;
- route bindings must be app-relative and validated by the server.

This is stricter than dynamic front-end plugin loading, but it keeps the browser boundary tractable.

## Alternatives Considered

### 1. Keep tool rendering in the client

Rejected because it scales linearly with adapter count and violates the intended dependency direction.

### 2. Make everything a generic card DSL

Rejected because it does not cover live process, terminal, route jump, or other non-card surfaces well enough.

### 3. Load adapter-owned React components dynamically

Rejected because it creates bundler coupling, version skew, security problems, and an unstable browser plugin boundary.

### 4. Persist rendered tool cards in the database

Rejected because presentation is derived and may change over time. Raw tool content must remain authoritative.

## Open Questions

- whether `tool_view` should be streamed as a new websocket event type or attached to existing tool-result updates;
- whether live process resources should reuse the current terminal websocket channel or use a separate host resource channel;
- whether adapter capability declarations should stay fully explicit or allow some shared defaults derived from runtime traits;
- whether route host bindings need a first-class typed route descriptor instead of raw app-relative strings.

## Recommendation

Adopt this RFC in two slices:

1. first land dynamic adapter catalog plus server-side tool presentation for static artifacts and summaries;
2. then add host resource bindings for live process and other stateful surfaces.

That ordering removes the biggest architectural coupling first without forcing an all-at-once redesign of terminal or live runtime handling.
