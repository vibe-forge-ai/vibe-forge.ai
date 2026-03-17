# WebSocket 目录说明

- index.ts：对外导出入口，保持路由与服务层引用稳定
- server.ts：WebSocket 连接建立、消息路由与生命周期管理
- interactions.ts：交互请求/响应的发起与超时处理
- events.ts：会话事件广播与会话更新通知
- notifications.ts：配置合并与系统通知
- cache.ts：会话与连接缓存、全局 socket 与交互等待队列
- utils.ts：WebSocket 通用工具

会话生命周期能力已迁移至 services/session.ts；websocket 目录只负责连接层、交互分发与事件广播。

理解路径建议：先从 index.ts 看有哪些对外能力，再读 server.ts 理解连接与消息流，随后阅读 interactions.ts 和 events.ts 了解交互与广播，最后结合 services/session.ts 补齐完整会话生命周期。
