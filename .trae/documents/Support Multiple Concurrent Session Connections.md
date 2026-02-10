我将在前端实现一个 `ConnectionManager` 来支持多个并发的 WebSocket 连接，从而实现不同会话状态的独立更新。

### 1. 创建连接管理器 (Connection Manager)

在 `apps/web/src/connectionManager.ts` 中创建一个单例的连接管理器：

- **统一管理**: 维护 `sessionId` 到 `WebSocket` 实例的映射表。
- **订阅机制**: 允许组件（如聊天窗口、侧边栏）订阅特定会话的消息事件。
- **生命周期控制**: 智能管理连接的建立与销毁。当组件卸载时（如切换会话），仅取消订阅而不强制关闭连接（可配置超时关闭），从而支持后台任务的状态更新。

### 2. 重构聊天组件 (Chat Component)

修改 `apps/web/src/components/Chat.tsx`：

- 移除直接调用 `createSocket` 的逻辑。
- 改为调用 `connectionManager.subscribe(sessionId, handlers)`。
- 确保在切换会话时，连接能够根据需要保持活跃，以便接收后台生成的回复。

### 3. 优化 WebSocket 工具

确保 `apps/web/src/ws.ts` 被管理器正确复用，保持现有协议逻辑不变。

**预期效果**:

- **并发支持**: 支持同时维持多个会话的 WebSocket 连接。
- **状态同步**: 即使切换到其他会话，原会话的后台任务（如长文本生成）仍可通过保持的连接接收更新。
- **基础架构**: 为后续在侧边栏显示“正在生成”等状态打下基础。
