# 在自己项目中使用

这份目录是面向用户的 Vibe Forge 使用文档入口；如果你要把 Vibe Forge 接入自己的项目，从这里开始。

如果你要看架构、维护约束或仓库开发规则，继续看 `.ai/rules/`。

## 先看这些

- [安装与准备](./usage/install.md)
- [数据资产目录配置](./asset-directories.md)
- [启动服务](./usage/runtime.md)
- [Web UI 与 Terminal 视图](./usage/web.md)
- [PWA 与独立部署](./usage/pwa.md)
- [Channel 会话绑定](./usage/channels.md)
- [CLI 与示例](./usage/cli.md)
- [Skills 与依赖](./usage/skills.md)
- [Workspace 调度](./usage/workspaces.md)
- [插件与数据资产](./usage/plugins.md)
- [Adapter 原生插件与 Marketplace](./usage/native-plugins.md)

## 接入目标

- 不需要 clone 本仓库，只需要安装相关包。
- 配置与会话基于你的项目目录，而不是 Vibe Forge 仓库本身。
- UI、CLI、MCP、hooks runtime 都可以按需单独接入。
- Web UI 的会话页支持独立 `terminal` 视图，但它和 chat 消息流是两条不同的运行链路。
