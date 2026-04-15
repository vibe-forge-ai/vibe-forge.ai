# @vibe-forge/adapter-claude-code 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/adapter-claude-code@0.11.1`

## 主要变更

- Claude Code adapter 现在会把从 workspace asset bundle 解析出来的 plugin-provided skills 同步到隔离的 Claude mock home，使通过 npm 插件分发的 skills 能被原生 Claude 运行时直接发现。
- 当解析结果里没有托管 skill 资产时，adapter 仍会回退到旧的 `.ai/skills` symlink 方案，兼容现有工作区结构。
- 新的 skill 同步逻辑会为 plugin skill 生成稳定的隔离目录名，避免不同来源的 skill 在 Claude home 中发生覆盖或路径漂移。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不引入新的 adapter 配置字段。
- 现有依赖 `.ai/skills` 的工作区无需迁移；只有在提供 plugin skill 资产时才会优先走新的同步路径。
