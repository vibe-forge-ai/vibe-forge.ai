# Server 约定

返回入口：[ARCHITECTURE.md](../ARCHITECTURE.md)

## 分层

- `routes/`、`websocket/`、`channels/` 只做协议适配、参数校验和入口编排。
- `services/` 统一承载配置读取、会话运行态、等待队列、广播通知和跨入口复用逻辑。
- `db/` 负责持久化；Repo 封装读写，不在 route / service 里直接写 SQL。

## 配置与状态

- Server 侧读取项目 / 用户配置时，统一通过 `apps/server/src/services/config.ts`。
- 会话运行态缓存、交互等待队列、广播 socket 集合统一放在 `apps/server/src/services/`。

## WebSocket Channel

- chat 会话和 terminal 会话是两套独立 websocket 协议，不要把 terminal 字节流塞进 chat `WSEvent`。
- chat 入口继续走既有 session runtime；terminal 入口通过 `channel=terminal` 分流到 `apps/server/src/websocket/terminal.ts`。
- terminal 的 socket 集合、scrollback、shell process 和空闲回收逻辑统一放在 `apps/server/src/services/terminal/`。
- terminal 运行态只保存在内存里；删除 session 时需要同时销毁 terminal runtime，避免留下悬空 socket 或孤儿进程。

## Schema

- DB schema 按领域拆分在 `apps/server/src/db/*.schema.ts` 中维护。
- `apps/server/src/db/index.ts` 负责把 schema 模块注入到 `initSchema`。
- 不要把所有建表和迁移持续堆到单一 schema 文件。
