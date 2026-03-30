# @vibe-forge/server 0.8.1

发布日期：2026-03-30

## 发布范围

- 发布 `@vibe-forge/server@0.8.1`

## 主要变更

- 将 Server 侧 SQLite 访问从 `better-sqlite3` 迁移到 Node.js 官方 `node:sqlite`
- 移除 `better-sqlite3` 原生依赖，降低安装和编译门槛
- 补充 Server DB 连接、事务与 schema 迁移相关测试，覆盖迁移后的主要回归面

## 兼容性说明

- Server 运行环境需使用支持 `node:sqlite` 的 Node.js 22.5+
