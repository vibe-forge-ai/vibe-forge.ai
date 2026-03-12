本目录用于服务端频道系统的模块化实现，包含加载器、状态管理、指令处理与事件处理。

工作约定：
- index.ts 仅负责初始化与对外导出，不新增业务逻辑
- handlers.ts 负责事件流转与会话路由
- commands.ts 仅处理频道指令，不写入会话消息
- state.ts 只管理内存状态与读取 channel_sessions 的绑定信息
- loader.ts 只负责动态加载频道连接模块

变更要求：
- 新增频道类型只在连接模块中处理具体事件名，server 侧只使用通用 message
- 任何对 channel_sessions 的写入必须同时更新内存绑定
- 删除会话时要同步清理 channel_sessions
