---
alwaysApply: true
---

# 项目架构说明 (Architecture)

Vibe Forge 是一个基于 Monorepo 结构的 AI 辅助开发工具框架，采用插件化架构，支持多种 AI 适配器。

## 目录结构

项目采用 `pnpm workspaces` 进行多包管理，分为应用层 (`apps`) 和核心库/适配器层 (`packages`)：

### 应用层 (Apps)

- **`apps/server`**: 后端服务 (Node.js + Koa)
  - `src/index.ts`: 入口文件，负责 HTTP 服务初始化、WebSocket 挂载。
  - `src/routes/`: 业务路由，如 `sessions` (会话管理) 和 `config` (系统配置)。
  - `src/websocket/`: 处理实时通信逻辑。
  - `src/db.ts`: 数据持久化层 (使用 SQLite)。
- **`apps/web`**: 前端应用 (React + Vite + Ant Design)
  - `src/components/`: 包含 `chat` (对话交互) 和 `sidebar` (侧边栏) 等业务组件。
  - `src/store/`: 状态管理。
  - `src/ws.ts` & `src/api.ts`: 封装与后端的实时通信和 REST 请求。
- **`apps/cli`**: 命令行工具
  - 提供 `vf` 命名空间下的指令，如 `mcp` 相关工具集成。

### 插件与核心层 (Packages)

- **`packages/core`**: 框架核心逻辑
  - `src/adapter/`: 定义适配器接口 (`Adapter`)、加载器 (`loader`) 及事件类型。
  - `src/controllers/`: 业务控制器，如任务执行 (`task`) 和系统资源 (`system`)。
  - `src/utils/`: 共享工具函数 (如 `uuid`, `cache`, `logger`)。
  - `src/ws.ts`: WebSocket 通信协议与事件定义。
- **`packages/adapters/*`**: AI 助手适配器实现
  - `claude-code/`: Claude Code CLI 的适配器实现，负责进程交互与事件解析。

## 核心设计理念

1. **插件化适配器 (Plugin-based Adapters)**:
   核心框架通过 `Adapter` 接口与具体的 AI 工具解耦。
2. **分层架构 (Layered Architecture)**:
   - **应用层**: 负责 UI 展示、API 路由和用户会话。
   - **核心层**: 负责业务逻辑编排、任务控制和协议定义。
   - **适配器层**: 负责具体 AI 工具的底层通信。
3. **强类型驱动 (Type-Safe)**:
   全栈使用 TypeScript，核心定义共享。

## 核心技术栈

- **前端**: React 18, Vite, Ant Design, SWR, Zustand (Store).
- **后端**: Koa 2, WebSocket (ws), SQLite.
- **核心**: TypeScript, Zod, Node.js `child_process`.

## 关键流程

1. **会话启动**: `server` 接收请求，通过 `core` 的 `loader` 加载适配器并建立 WebSocket 连接。
2. **交互流**: 前端通过 WebSocket 发送指令 -> `server` 转发至 `core/task` -> 调用 `adapter` 执行 -> 结果流式回传。
3. **工具集成**: `apps/cli` 提供了 MCP (Model Context Protocol) 风格的工具集成能力。
