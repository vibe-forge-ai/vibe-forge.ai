我将根据您的要求，实现会话状态的自动流转、存储和展示。

### 1. 核心类型定义 (`packages/core/src/types.ts`)

- 定义 `SessionStatus` 类型，包含以下明确状态：
  - `running`: 任务进行中
  - `completed`: 任务完成
  - `failed`: 任务失败/异常
  - `terminated`: 任务被终止
  - `waiting_input`: 等待用户确认/输入 (预留)
- 更新 `Session` 接口，增加 `status` 字段。

### 2. 数据库与存储 (`apps/server/src/db.ts`)

- **Schema**: 在 `sessions` 表中新增 `status` 字段。
- **迁移**: 在 `init()` 中添加自动检测和 `ALTER TABLE` 逻辑。
- **CRUD**: 更新 `createSession`, `updateSession`, `getSession` 等方法以支持 `status` 字段。

### 3. 后端状态流转逻辑 (`apps/server/src/websocket/index.ts`)

状态将由系统事件自动驱动，而非手动修改：

- **`running`**: 用户发送消息 (`processUserMessage`) 时触发。
- **`completed` / `failed`**: Adapter 进程退出 (`exit` 事件) 时，根据 `exitCode` 是否为 0 自动判断。
- **`terminated`**: 用户手动停止会话 (`killSession`) 时触发。
- **通知**: 每次状态变更后，调用 `notifySessionUpdated` 通过 WebSocket 实时推送给前端。

### 4. 前端展示 (`apps/web/src/components/sidebar/SessionItem.tsx`)

- 在会话列表中，根据 `status` 渲染不同的状态标签（Tag）：
  - `running`: 蓝色 (Processing)
  - `completed`: 绿色 (Done)
  - `failed`: 红色 (Error)
  - `terminated`: 灰色 (Stopped)
- 确保状态变化能通过 WebSocket 实时更新 UI。
