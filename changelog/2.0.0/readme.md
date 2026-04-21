# 2.0.0

发布日期：2026-04-20

## 发布范围

- 统一发布全部 public workspace 包到 `2.0.0`
- 覆盖 CLI、Server、Client、MCP、Task、Hooks、Config、Utils、Types、Benchmark、Lark channel、内置 adapter、plugins 以及 support 包

## 主要变更

- 将全部 public workspace 包切到 `2.0.0` 版本线，作为新一轮上游协同升级基线。
- CLI 现在会稳定遵循项目在启动目录 `.env` / `.env.dev` 中声明的 workspace 路径，不再把运行时 `cwd` 错误保留在启动目录。
- config、register 与相关运行时路径解析链路继续围绕“启动目录 env 驱动 workspace、AI 目录和配置目录”这一模型收敛，减少下游接入层的额外补丁。
- 补强 adapter symlink 与 Codex mock-home 相关稳定性问题，降低安装和本地运行时的竞态风险。

## 兼容性说明

- 本次为协调式整体 major 发布，建议消费方按同一版本线整体升级全部 `@vibe-forge/*` 依赖。
- 依赖运行时 `cwd`、配置目录或 `.ai` 基础目录覆盖能力的消费方，升级后应重新执行一次 `ai` / `vf` 的 smoke 测试，确认工作目录与运行产物目录符合预期。
