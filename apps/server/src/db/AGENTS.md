# DB 目录说明

- index.ts：数据库聚合入口，负责连接、schema 模块注入与 repo 装配
- schema.ts：schema 初始化编排器，只负责执行注入的 schema 模块与提供迁移 helper
- sessions/：session 领域目录，包含 schema、sessions repo、messages repo 与 tags repo
- channelSessions/：channel session 领域目录，包含 schema 与 repo
- automation/：automation 领域目录，包含 schema 与 repo
- repo.utils.ts：repo 层共享的 SQL update 语句构建 helper

分层约定：新增表结构或迁移时，不要继续往单一 schema 文件累加；应在对应领域目录内的 schema.ts 维护，并由 db/index.ts 注入到 initSchema。

扩展约定：initSchema 只做组合与执行，schema 模块自己维护 create/migration 细节；repo 不负责 schema 创建。
