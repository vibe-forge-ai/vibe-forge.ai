# Vibe Forge AI

Vibe Forge 是一个基于 Monorepo 结构的 AI 辅助开发工具，旨在提供流畅的对话式开发体验。

## 核心特性

- **对话式交互**: 基于 React 构建的现代化 UI，支持流式输出和实时任务跟踪。
- **工具化支持**: 内置 Bash、Write、Read、Todo 等多种工具，AI 可直接操作文件系统和执行命令。
- **多语言支持**: 完整集成 i18n，支持中英文一键切换。
- **持久化存储**: 使用 SQLite 存储会话历史，确保数据安全。
- **响应式设计**: 优化的侧边栏布局，支持自动收起和宽度调整。

## 快速开始

### 环境依赖

- [Node.js](https://nodejs.org/) (建议 v18+)
- [pnpm](https://pnpm.io/) (建议 v8+)

### 安装与运行

1. 克隆项目并进入目录：
   ```bash
   git clone <repository-url>
   cd vibe-forge.ai
   ```

2. 安装依赖：
   ```bash
   pnpm install
   ```

3. 启动开发环境：
   ```bash
   pnpm dev
   ```
   _注意：该命令会同时启动后端服务 (`apps/server`) 和前端应用 (`apps/web`)。_

## 配置文件

- 仅支持 JSON/YAML 配置：`.ai.config.json`、`.ai.config.yaml`/`.yml` 及其 `.ai.dev.config.*` 变体。
- 系统配置页为只读展示，如需修改请直接编辑配置文件。

## 开发与维护工具

为了保持代码质量，项目集成了以下检查工具：

| 工具           | 指令                        | 适用场景                                                    |
| :------------- | :-------------------------- | :---------------------------------------------------------- |
| **ESLint**     | `npx eslint .`              | 检查代码规范、潜在 Bug 及类型安全隐患。建议在提交前必运行。 |
| **Dprint**     | `npx dprint fmt`            | 快速格式化全量代码，保持风格统一。                          |
| **TypeScript** | `pnpm -r exec tsc --noEmit` | 全量类型检查，特别是在修改 `packages/core` 或 API 结构后。  |
| **Vitest**     | `pnpm test`                 | 运行单元测试，确保核心逻辑和适配器功能正常。                |

## 目录结构

- `apps/server`: 后端 Koa 服务，处理 AI 逻辑、WebSocket 和数据库。
- `apps/web`: 前端 React 应用，提供用户交互界面。
- `packages/core`: 内部共享的核心工具包。
- `.trae/rules`: 项目开发规范与架构说明。

## 贡献指南

请参考 `.trae/rules/` 目录下的相关文档：

- [架构说明](./.trae/rules/architecture.md)
- [前端开发规范](./.trae/rules/frontend_standard.md)
- [维护指南](./.trae/rules/maintenance.md)

## 许可证

[LICENSE](./LICENSE)
