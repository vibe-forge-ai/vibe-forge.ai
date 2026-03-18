# Session 服务目录说明

- index.ts：会话生命周期主入口，负责 Adapter 会话启动、用户消息注入、状态更新、中断与终止
- create.ts：会话创建编排，负责初始消息注入、标签初始化与按需启动会话
- events.ts：会话事件落库与状态派生，负责从消息中提取摘要并更新会话元信息
- interaction.ts：交互请求/响应服务，负责等待用户输入、超时处理与 external session 交互闭环
- notification.ts：会话状态通知，基于 config 子域装载的统一配置决定是否发送系统通知
- runtime.ts：会话运行态仓库，统一维护 socket、消息缓存、交互等待队列与广播

边界约定：session 子域统一承载所有会话生命周期与运行态逻辑；routes、websocket、channels 只能调用对外服务，不直接操作内部 store。

理解路径建议：先读 runtime.ts 建立运行态模型，再读 index.ts 看主流程，随后阅读 interaction.ts、create.ts 与 events.ts，最后补 notification.ts 理解状态通知分支。
