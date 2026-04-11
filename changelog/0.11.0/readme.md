# 0.11.0

发布日期：2026-04-12

## 发布范围

- 统一发布全部 public workspace 包到 `0.11.0`
- 覆盖 CLI、Server、Client、MCP、Task、Hooks、Config、Utils、Types、Benchmark、Lark channel、内置 adapter、plugins 以及 support 包

## 主要变更

- Lark channel 与 server 补齐 session companion MCP、tool call 详情链路和更稳定的深链接/动作链接处理。
- Channel 初始化现在会把 connected / disabled / error 状态写进启动日志，并兼容旧版 Lark 发布包缺失 `./mcp` export 的场景。
- Web Chat 继续重构工具调用展示，改进 tool summary、diff/renderer 结构，并补上聊天消息与工具定位的深链接体验。
- adapter runtime 进一步加强原生 skills 与 mock home 同步；Codex runtime 自动同步 workspace skills 并默认关闭启动更新检查，Claude adapter 提升 resume 容错并补上 Kimi CCR transformer 兼容。
- 默认内置 Vibe Forge MCP 现在可直接启用，同时修复 managed runtime 插件解析、register runtime transpile 判断和任务侧 project skill 查询链路。
- Chrome 调试与 channel 自动化稳定性继续提升，补强 OpenAPI domain 处理和 messenger automation 的可靠性。

## 兼容性说明

- 本次为协调式整体版本升级，所有 public workspace 包统一提升到 `0.11.0`，建议消费方按同一版本线整体升级。
- 默认 MCP 启用与 runtime / adapter 行为在多个包中联动；若消费方只单独升级局部包，建议至少同步 `@vibe-forge/config`、`@vibe-forge/hooks`、`@vibe-forge/mcp`、`@vibe-forge/app-runtime`、`@vibe-forge/task` 与对应 adapter。
- 聊天深链接、Lark tool call detail 与 companion MCP 属于增量能力；现有接入通常可继续工作，但如果你消费相关 URL、卡片或工具事件表现，建议同步做一次联调验证。
