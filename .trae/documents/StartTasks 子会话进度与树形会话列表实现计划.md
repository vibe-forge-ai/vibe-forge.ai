## 目标对齐
- 按设计文档落地：子会话=独立 session、父子层级持久化、前端树形展示、StartTasks 实时进度与交互
- 复用 WebSocket 事件模型，抽象通用事件处理逻辑，保证扩展性与一致性

## 数据层改动
- `apps/server/src/db.ts`
  - sessions 表新增 `parentSessionId` 字段并做兼容迁移
  - 新增/完善 CRUD：创建子会话、按父会话查询子会话、构建树数据（用于列表接口）
- `apps/server/src/types.ts`
  - 补齐会话类型中的 `parentSessionId`

## 服务端通用事件处理与接口
- 抽离通用事件处理器（新文件，如 `apps/server/src/services/sessionEvents.ts`）
  - 输入 `sessionId + WSEvent`，统一执行：写入 messages、更新 session 状态、广播 `session_updated`
  - WebSocket 与 mcp 上报共用该逻辑
- 接口调整（符合规范挂载到 `/api`）
  - `POST /api/sessions` 支持创建子会话（可不启动任务）
  - `POST /api/sessions/:id/events` 支持外部触发事件（message/summary/exit/stop/interaction_request）

## CLI/MCP StartTasks 改造
- `apps/cli/src/mcp-tools/task`
  - StartTasks 前调用服务端创建子会话并建立父子映射
  - 运行任务时把事件流按统一 WSEvent 格式上报到 server
  - 任务结束上报 exit/stop 与状态
- 抽取可复用同步层（新模块，如 `apps/cli/src/mcp-sync`），替代临时上报逻辑

## 前端树形列表与实时进度
- 会话列表树形展示（sidebar 组件）
  - 使用树结构渲染父子层级，支持缩进/折叠
  - i18n 文案同步补齐
- StartTasks 卡片实时进度
  - 为每个 task sessionId 建立 WS 订阅（复用 connectionManager）
  - 展示子会话最新 message 流与状态，并提供跳转入口

## 验证与回归
- 覆盖：创建子会话、事件上报、列表树渲染、StartTasks 实时更新
- 运行必要检查与最小回归（前后端）确保无破坏性变更

确认后我将按此计划完成实现。