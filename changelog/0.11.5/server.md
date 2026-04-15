# @vibe-forge/server 0.11.5

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/server@0.11.5`

## 主要变更

- server 启动入口与 channel prompt 侧的 agent rules 加载路径，现在会跟随项目配置的 AI 基目录解析。
- `/api/config` 返回的合并配置里会展示当前实际生效的 AI 基目录，便于在 UI 和排障时确认目录覆盖结果。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增 server 路由或请求参数。
- 未配置环境变量时，服务端仍默认使用 `.ai` 目录。
