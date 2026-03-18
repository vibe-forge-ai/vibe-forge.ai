# WebSocket 目录说明

- index.ts：WebSocket 入口导出，避免上层直接耦合实现文件
- server.ts：WebSocket 连接建立、协议解析与生命周期回调

边界约定：websocket 目录只负责连接和协议；会话缓存、交互等待队列、事件广播、配置读取都放在 services 下。

理解路径建议：先从 server.ts 看 WebSocket 协议入口，再跳到 services/session/runtime.ts、services/session/interaction.ts 和 services/session/index.ts 理解真正的运行态与业务逻辑。
