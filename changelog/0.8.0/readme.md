# 0.8.0

发布日期：2026-03-30

## 发布范围

- 统一发布全部 public workspace 包到 `0.8.0`
- 覆盖 CLI、Server、Client、MCP、Task、Hooks、Config、Utils、Types 以及相关 adapter / plugin / support 包

## 主要变更

- 重构运行时分层，拆分 `core` 职责，形成 `task`、`mcp`、`hooks`、`app-runtime`、`workspace-assets`、`definition-loader` 等更清晰的包边界
- 将共享配置、adapter 契约、benchmark 契约、logger 与通用工具继续下沉到 `config`、`types`、`utils`
- 独立 `vf-mcp` 启动入口，MCP server 可独立运行
- 应用层通过 `app-runtime` 访问 `task`、`benchmark`、`mcp`，减少 `apps/*` 对运行时包的直接耦合
- 文档入口统一迁移到 `.ai/rules/`，新增仓库级 `AGENTS.md` 阅读指引

## 兼容性说明

- 包版本统一为 `0.8.0`
- 发布后如果项目内部引用了旧的 workspace 版本号，需要同步更新到 `0.8.0`

## 备注

- 本版本包含较大规模架构治理，适合与最新文档一起阅读：
  - `.ai/rules/ARCHITECTURE.md`
  - `.ai/rules/DEVELOPMENT.md`
  - `.ai/rules/USAGE.md`
