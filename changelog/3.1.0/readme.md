# VibeForge 3.1.0

## Changes

- Add config support for disabling automatic skill dependency downloads, covering config parsing, workspace asset resolution, and task preparation.
- Scope adapter resume caches by task/session context to avoid cross-task resume state reuse in CLI, MCP, and server runtime paths.
- Deduplicate Codex managed root config keys before writing generated runtime config.
- Update Kimi adapter metadata to use the official cropped icon.

## Release Scope

- Publish runtime/config packages that changed directly: `@vibe-forge/types`, `@vibe-forge/utils`, `@vibe-forge/core`, `@vibe-forge/config`, `@vibe-forge/workspace-assets`, `@vibe-forge/task`, `@vibe-forge/mcp`, `@vibe-forge/server`, `@vibe-forge/adapter-codex`, and `@vibe-forge/adapter-kimi`.
- Publish runtime entrypoints and adapter/plugin dependency closure on the same `3.1.0` line so installed CLI, server, web, adapter, and plugin packages resolve a coherent internal runtime set.
