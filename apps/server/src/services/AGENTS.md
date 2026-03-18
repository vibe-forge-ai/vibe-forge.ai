# Services 目录说明

- config/：配置子域服务目录，统一负责 workspace 变量、配置读取与合并
- automation/：automation 子域服务目录，负责规则执行与触发器调度
- session/：会话子域服务目录，统一负责生命周期、交互、通知与运行态管理

分层约定：services 统一承载跨入口复用的业务编排、运行态状态和配置装载；routes/websocket/channels 不直接维护会话缓存，不直接拼装 loadConfig 的 jsonVariables。

理解路径建议：先读 config/、automation/ 和 session/runtime.ts 建立基础认知，再读 session/index.ts 和 session/interaction.ts 理解会话运行时流程，最后结合 session/create.ts 与 session/events.ts 看创建、落库与状态派生。
