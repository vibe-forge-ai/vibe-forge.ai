## 需求理解与目标

- 当 StartTasks 触发多个任务时，前端可实时看到子任务进度，并可进入子任务会话进行交互
- 服务端需持久化会话层级关系（父会话 → 子会话）并支持树形展示
- mcp 上报过程复用 WebSocket 的事件模型，抽象为通用事件处理逻辑，便于复用与扩展

## 方案概览

- 以“子会话=独立 session”的方式承载每个 task 的进度流与交互
- 服务端新增会话层级字段与通用事件处理器，使 WebSocket 与 mcp 上报共用同一处理链路
- 前端会话列表渲染树结构，StartTasks 卡片实时订阅子会话的进度流并提供跳转/交互入口

## 数据层与类型调整

- 在 `sessions` 表新增 `parentSessionId`（可空）字段，用于父子关系
- 在 `apps/server/src/types.ts` 中同步补齐类型字段
- 在 `apps/server/src/db.ts` 中：
  - 更新建表与兼容迁移逻辑（若缺列则添加）
  - 新增/调整 CRUD：创建子会话、按父会话获取子会话、构建树形结构数据

## 服务端事件复用与新接口

- 抽象通用事件处理器（例如 `apps/server/src/services/sessionEvents.ts`）：
  - 输入 `sessionId + WSEvent`，统一执行：保存消息、更新会话状态、广播 `session_updated`
  - 复用现有 WebSocket 处理逻辑，减少重复与保证一致
- 接口调整（示例）：
  - `POST /api/sessions`：支持创建子会话的时候不启动任务
  - `POST /api/sessions/:id/events`：支持由外部触发的非内源性事件触发接口（message/summary/exit/stop/interaction_request）

## CLI/MCP 侧改造（StartTasks）

- 在 `apps/cli/src/mcp-tools/task` 中：
  - 在 StartTasks 执行前调用服务端接口创建子会话并建立父子映射
  - 在 task 事件流中，将事件按统一协议上报到 server（复用 WebSocket 事件结构）
  - 任务完成后上报 exit/stop 与最终状态

## 前端展示与交互

- 会话列表树形展示：
  - 在 sidebar 会话列表组件中构建树数据（父会话 → 子会话）
  - 支持折叠/缩进展示（沿用现有样式规范与 i18n 文案）
- StartTasks 卡片实时进度：
  - 为每个 task sessionId 建立 WS 订阅（复用 `connectionManager`）
  - 渲染子会话的最新 message 流与状态，提供跳转到子会话的入口
- 交互处理：子会话等待输入时可直接跳转进入会话完成交互

## 验证与兼容

- 确保新接口与原有 WebSocket 事件处理一致
- 使用现有会话列表与聊天页面完成端到端验证
- i18n 文案在 `zh.json/en.json` 同步补齐

如果确认该方案，我将按上述步骤逐步实现，并在实现过程中严格遵循项目规范（路由挂载、db 封装、i18n、样式与 import 规则）。
