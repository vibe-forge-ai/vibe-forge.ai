# Server Src 目录说明

- index.ts：服务启动入口，只负责组装 Koa、HTTP Server、WebSocket 挂载与配置装载
- routes/：HTTP 传输层，只处理请求校验、状态码和响应格式，不承载运行态状态
- websocket/：WebSocket 传输层，只处理连接、协议消息解析与生命周期回调
- services/：应用服务层，集中放置会话运行态、配置装载、业务编排与跨传输层复用逻辑
- services/config/：配置子域服务，统一承载 workspace 变量、配置读取与合并
- services/session/：会话子域服务，统一承载生命周期、交互、通知与运行态管理
- services/automation/：automation 子域服务，集中放置规则执行与调度逻辑
- channels/：频道接入层，处理外部 IM/机器人平台消息管道
- db/：持久化层，封装 SQLite 连接、按领域拆分的 schema 模块与 repo
- utils/：无业务归属的基础工具

分层约定：routes/websocket/channels 只能做协议适配与参数整理；会话状态、配置装载、广播通知、交互等待队列等跨入口共享能力统一放在 services。

配置约定：server 侧读取项目/用户配置时，统一经过 services/config/，避免在各模块内直接重复调用 loadConfig 和拼接 jsonVariables。

DB 约定：schema 初始化必须走 `db/initSchema + schema modules` 的组合方式；新增领域时在 `db/*.schema.ts` 独立维护表结构和迁移，再由 `db/index.ts` 注入，避免单文件持续堆积。

领域约定：automation 不再放在 src/automation；规则执行、legacy 数据兼容和 scheduler 状态统一收敛到 services/automation/，routes/automation.ts 只保留 HTTP 入参与响应处理。
