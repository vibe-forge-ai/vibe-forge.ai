# 0.10.0

发布日期：2026-04-09

## 发布范围

- 统一发布全部 public workspace 包到 `0.10.0`
- 覆盖 CLI、Server、Client、MCP、Task、Hooks、Config、Utils、Types、Benchmark、Lark channel、内置 adapter、plugins 以及 support 包

## 主要变更

- Web Chat 输入区升级为 Monaco editor，并继续补强快捷键、补全、焦点恢复和交互面板体验。
- 新增交互式 terminal session view 与 dock panel，补齐前后端 terminal 生命周期、websocket 同步和主题对齐。
- 统一权限确认记忆链路，在 Web Chat、Server session、Codex/OpenCode adapter 与 hooks runtime 间共享更稳定的权限交互与恢复行为。
- Codex adapter 新增 transcript tool hooks bridge，补齐 transcript 事件桥接、工具调用观测和相关 E2E/单测覆盖。
- 改进聊天页与侧边栏交互，包括消息级上下文菜单、批量选择/搜索、会话操作入口和若干消息渲染细节。
- 修复配置更新与缓存持久化边界问题，避免部分字段被误覆盖，并提升损坏 cache 文件或临时文件冲突时的容错性。

## 兼容性说明

- 本次为协调式整体版本升级，所有 public workspace 包统一提升到 `0.10.0`，建议消费方按同一版本线整体升级。
- 权限交互相关 schema 新增 `subjectKey`、`subjectLabel`、`scope`、`projectConfigPath` 等字段；旧调用方式仍可继续使用，但若要获得新的 project/session 级权限体验，建议同步接入。
- 新增 terminal 会话事件与命令类型，接入方如果消费 `@vibe-forge/types` 的 terminal 相关导出，需要按 `terminal_ready / terminal_output / terminal_exit / terminal_error` 与对应 command 结构更新兼容处理。
