# 项目架构说明 (Architecture)

Vibe Forge 是一个基于 Monorepo 结构的 AI 辅助开发工具。

## 目录结构

- `apps/server`: 后端服务 (Node.js + Koa)
  - `src/server.ts`: 入口文件，负责 HTTP 服务、WebSocket 连接管理和路由挂载。
  - `src/routes/`: 业务路由模块。
    - `sessions.ts`: 会话管理（CRUD）。
    - `projects.ts`: 项目管理。
    - `config.ts`: 系统配置管理。
  - `src/db.ts`: 数据持久化层 (使用 SQLite 存储)。
  - `src/adapters/`: 外部 CLI/AI 适配器层，封装不同助手的调用逻辑 (如 Claude CCR)。
  - `src/websocket/`: WebSocket 通信处理。
  - `src/env.ts`: 环境变量加载与管理。
- `apps/web`: 前端应用 (React + Vite + Ant Design)
  - `src/main.tsx`: 应用入口，配置全局 Provider (SWR, Router, AntD)。
  - `src/App.tsx`: 根组件，定义路由布局。
  - `src/components/`: 业务组件。
    - `Chat.tsx`: 对话交互界面。
    - `Sidebar.tsx`: 侧边栏会话列表。
  - `src/api.ts`: 封装与后端的 HTTP 请求。
  - `src/ws.ts`: 封装 WebSocket 通信逻辑。

## 核心技术栈

- **前端**: React 18, Vite, Ant Design, SWR (数据请求), React Router 7, i18next (国际化).
- **后端**: Koa 2, Koa Router, WebSocket (ws), tsx (开发运行)。
- **存储**: 轻量级 SQLite 数据库 (位于 `~/.vf/db.sqlite`)。
- **包管理**: pnpm Workspaces。
- **国际化**: 支持中英文切换，配置位于 `apps/web/src/i18n.ts`，资源文件位于 `apps/web/src/resources/locales/`。

## 关键流程

1. **路由跳转**: 使用 `react-router-dom` 处理，通过 URL 中的 `sessionId` 驱动界面。
2. **数据同步**: 前端通过 SWR 自动缓存和同步后端 API 数据。
3. **实时交互**: 通过 WebSocket 实现与后端 CLI 的流式输出同步。
