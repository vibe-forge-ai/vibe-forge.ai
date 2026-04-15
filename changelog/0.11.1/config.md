# @vibe-forge/config 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/config@0.11.1`

## 主要变更

- 默认内建 MCP 的标准名统一为 `VibeForge`。开启默认内建 MCP 时，项目/用户配置里自动补入的权限项也会同步使用 `VibeForge`，不再继续写旧的 `vibe-forge`。
- 默认内建 MCP 配置的测试覆盖同步更新，确保配置加载、默认权限注入和 workspace bundle 的命名一致。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改变 `defineConfig()` 或配置文件结构。
- 运行时仍会配合 server / adapter 的权限解析处理 Codex 内建 MCP 的历史审批 key。
