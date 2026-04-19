---
rfc: 0002
title: Entity Inheritance
status: draft
authors:
  - Codex
created: 2026-04-19
updated: 2026-04-19
targetVersion: vNext
trackingIssue: https://github.com/vibe-forge-ai/vibe-forge.ai/issues/137
futureIssue: https://github.com/vibe-forge-ai/vibe-forge.ai/issues/138
---

# RFC 0002: Entity Inheritance

## Summary

Add `extends` and `inherit` fields to Vibe Forge entities so a project entity can build on existing local or plugin entities.

The first version keeps inheritance easy to reason about:

- `extends` accepts one entity reference or an ordered list of references.
- plugin entities are referenced through the existing `scope/name` asset identifier.
- multiple parents are composed in `extends` order into an inherited base.
- `inherit` controls only how the current entity receives that inherited base.
- prompt, rules, skills, and tags are additive by default.
- tool and MCP filters are conservative by default and use child values when present.

Advanced per-parent merge policies are intentionally deferred to a separate issue.

## Motivation

Project teams already use shared entities from plugins such as `standard-dev`, then add project-specific constraints. Today they must copy the whole entity body and metadata, which makes plugin updates hard to consume and encourages drift.

Inheritance lets users write small, focused project entities:

```yaml
---
name: frontend-reviewer
description: 前端评审实体
extends:
  - std/dev-reviewer
inherit:
  prompt: append
  rules: merge
  skills: merge
  tools: replace
  mcpServers: replace
---

在标准评审要求上，额外关注交互、样式、focus、主题和移动端布局。
```

## Goals

- Support `extends: <entity-ref>` and `extends: [<entity-ref>, ...]` in Markdown and `index.json` entities.
- Support references to scoped plugin entities, for example `std/dev-reviewer`.
- Merge multiple parents in the order listed by `extends`.
- Add `inherit` controls for the current entity versus the inherited base.
- Include inherited entity asset ids in `promptAssetIds`.
- Detect missing parents, ambiguous references, and inheritance cycles.
- Add tests for local inheritance, plugin inheritance, multiple parents, replacement behavior, and cycles.

## Non-Goals

- Do not support per-parent merge strategy objects in V1.
- Do not inherit parent `plugins` overlays in V1.
- Do not introduce package-name entity references such as `@vibe-forge/plugin-standard-dev/dev-reviewer`.
- Do not change entity route listing semantics.
- Do not change how rules, skills, MCP servers, or tools are resolved outside selected entity mode.

## Entity References

Entity references reuse existing asset selection semantics:

- `reviewer`: resolve a local or globally unique entity named `reviewer`.
- `std/dev-reviewer`: resolve entity `dev-reviewer` from plugin scope `std`.
- inside a plugin entity, unscoped refs first resolve to the same plugin instance.
- ambiguous unscoped references fail and ask users to use a scoped reference.

## Parent Composition

When `extends` contains multiple parents, parents are composed into one inherited base first:

```text
parentA -> parentB -> currentEntity
```

Parent-to-parent composition is fixed in V1:

| Field                                   | Parent composition                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| prompt/body                             | append in extends order                                                               |
| introduction/personality/memory content | already part of body, append in extends order                                         |
| tags                                    | merge and de-duplicate                                                                |
| rules                                   | merge and de-duplicate                                                                |
| skills                                  | merge include lists when possible; later non-mergeable selectors replace earlier ones |
| tools                                   | later parent overrides earlier parent                                                 |
| mcpServers                              | later parent overrides earlier parent                                                 |
| description                             | later parent overrides earlier parent                                                 |
| always                                  | later parent overrides earlier parent                                                 |
| name                                    | never inherited                                                                       |
| plugins                                 | never inherited                                                                       |

## Current Entity Inheritance

After parent composition, the current entity applies `inherit` against the inherited base.

Default behavior:

```yaml
inherit:
  prompt: append
  tags: merge
  rules: merge
  skills: merge
  tools: replace
  mcpServers: replace
```

Supported modes:

- `append`: parent value first, child value second.
- `prepend`: child value first, parent value second.
- `merge`: merge compatible values and de-duplicate.
- `replace`: use the child value when present; otherwise keep the inherited value.
- `none`: ignore the inherited value and use only the child value.

`inherit` may also be a single mode string that applies as `default`.

Example:

```yaml
extends:
  - std/dev-reviewer
  - frontend-reviewer-base
inherit:
  rules: replace
  tools: replace
```

Here, `std/dev-reviewer` and `frontend-reviewer-base` first merge their rules into the inherited base. Then `rules: replace` means the current entity uses only its own `rules`.

## Error Handling

- Missing parent: include available entity display names in the error.
- Ambiguous parent: reuse the existing ambiguous asset reference error.
- Circular inheritance: report the full chain, for example `a -> b -> a`.
- Invalid inherit mode: fail fast and name the invalid field.

## Future Work

Advanced inheritance controls are deferred:

- per-parent merge modes;
- explicit `extends` entries with `ref`, `mode`, or field strategies;
- parent-specific field suppression;
- inheriting plugin overlays with a clearer plugin graph model.
