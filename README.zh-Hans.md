# Vibe Forge AI

[en-US](./README.md) | zh-Hans

Vibe Forge 是一个 AI 辅助开发框架，提供桌面应用、VS Code 扩展、PWA / Web UI 与 CLI，支持插件化适配器、任务编排和多服务端接入。

## 产品预览

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./.docs/zh-hans/desktop-chat-dark.png">
  <img alt="Vibe Forge 桌面端会话页预览" src="./.docs/zh-hans/desktop-chat-light.png">
</picture>

## 在线入口

- PWA / Web UI：[https://vibe-forge-ai.github.io/pwa/](https://vibe-forge-ai.github.io/pwa/)

## 关键能力

- **对话式交互**：流式输出、会话管理、工具调用可视化。
- **任务与自动化**：会话归档、规则触发、运行记录统一管理。
- **可扩展架构**：适配器与插件分层，配置驱动、易于接入。
- **多入口运行**：桌面应用、VS Code 扩展、PWA / Web UI 与 CLI 可独立使用，也可接入现有项目。

## 安装方式

### 桌面应用

- 从 [GitHub Releases](https://github.com/vibe-forge-ai/vibe-forge.ai/releases) 下载 `desktop-v*` 发布产物。
- macOS：Intel（`x64`）与 Apple Silicon（`arm64`）分别提供 `.dmg`、`.zip`
- Windows：正式安装包暂未提供，后续补发见 [#161](https://github.com/vibe-forge-ai/vibe-forge.ai/issues/161)
- Linux：`.AppImage`、`.deb`、`.tar.gz`
- 当前桌面 release / CI artifact 默认不签名，首次启动时系统可能会提示安全确认。

### CLI

- Homebrew 安装：`brew install vibe-forge-ai/tap/vibe-forge`
- Windows PowerShell 安装：`irm https://raw.githubusercontent.com/vibe-forge-ai/vibe-forge.ai/master/scripts/install-windows.ps1 | iex`
- Scoop 安装：`scoop bucket add vibe-forge https://github.com/vibe-forge-ai/scoop-bucket; scoop install vibe-forge`

### 在项目里接入 Web UI / CLI

```bash
pnpm add -D @vibe-forge/server @vibe-forge/client @vibe-forge/cli @vibe-forge/adapter-claude-code
```

## 使用方式

### 直接用桌面应用

- 下载并启动桌面应用即可开始使用。
- 连接方式、服务端切换和桌面模式说明见 [桌面应用](./.ai/docs/usage/desktop.md)。

### 直接用 PWA / Web UI

- 在线地址：[https://vibe-forge-ai.github.io/pwa/](https://vibe-forge-ai.github.io/pwa/)
- 安装、独立部署和连接后端服务的方式见 [PWA 与独立部署](./.ai/docs/usage/pwa.md)。

### 直接用 VS Code 扩展

- 在 Activity Bar 打开 Vibe Forge，完整 client 会嵌入左侧边栏。
- workspace server 发现、配置项和本地源码试用方式见 [VS Code 扩展](./.ai/docs/usage/vscode-extension.md)。

### 从源码试用桌面端

```bash
pnpm desktop:dev
pnpm desktop:package
pnpm desktop:make
```

### 在自己项目中跑 Web UI / CLI

- [安装与准备](./.ai/docs/usage/install.md)
- [启动服务](./.ai/docs/usage/runtime.md)
- [桌面应用](./.ai/docs/usage/desktop.md)

## 文档入口

- [在自己项目中使用](./.ai/docs/index.md)
- [安装与准备](./.ai/docs/usage/install.md)
- [桌面应用](./.ai/docs/usage/desktop.md)
- [PWA 与独立部署](./.ai/docs/usage/pwa.md)
- [VS Code 扩展](./.ai/docs/usage/vscode-extension.md)
- [启动服务](./.ai/docs/usage/runtime.md)
- [本仓库开发与贡献](./.ai/rules/DEVELOPMENT.md)

## 许可证

[LICENSE](./LICENSE)
