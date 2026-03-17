# Services 目录说明
- session.ts：Adapter 会话启动、消息写入、状态更新与终止
- sessionCreate.ts：会话创建、初始消息注入与标签初始化
- sessionEvents.ts：会话事件落库、状态派生与消息内容提取

理解路径建议：先读 sessionCreate.ts 了解会话是如何被创建和启动的，再读 session.ts 理解运行态管理，最后阅读 sessionEvents.ts 看事件如何落库与更新会话状态。