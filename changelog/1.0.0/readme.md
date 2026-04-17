# 1.0.0

发布日期：2026-04-17

## 发布范围

- 统一发布全部 public workspace 包到 `1.0.0`
- 覆盖 CLI、Server、Client、MCP、Task、Hooks、Config、Utils、Types、Benchmark、Lark channel、内置 adapter、plugins 以及 support 包

## 主要变更

- 将 `vibe-forge` 全部 public workspace 包收敛到 `1.0.0` 版本线，结束此前按包独立递增的小版本分叉。
- CLI、config、register 与 entry/runtime 路径解析链路已支持由启动目录 `.env` 驱动的 workspace、`.ai` 和配置目录覆盖。
- Client、Server、Task、MCP、Hooks 与 adapters 继续沿用最近几个 `0.11.x` 版本线已经稳定下来的能力与行为，作为 `1.0.0` 的稳定基线。

## 兼容性说明

- 本次为协调式整体 major 发布，所有 public workspace 包统一提升到 `1.0.0`，建议消费方按同一版本线整体升级。
- 依赖 `@vibe-forge/*` 多个包协同工作的接入层，升级时应至少同步 CLI、Server、Config、Register、Hooks、Task 以及对应 adapter。
- 启动目录 env 覆盖属于向后兼容的新增能力；未配置相关 env 的项目会继续保持现有默认行为。
