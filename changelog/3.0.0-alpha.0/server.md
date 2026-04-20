# @vibe-forge/server 3.0.0-alpha.0

发布日期：2026-04-21

## 发布范围

- 发布 `@vibe-forge/server@3.0.0-alpha.0`

## 主要变更

- 将公开 bin 从 `vibe-forge-ui-server` / `vfui-server` 收敛为 `vibe-forge-server`
- 默认启动语义改为 headless server，不再默认托管 UI
- 抽出可复用的 server runtime，供 `@vibe-forge/web` 与 `@vibe-forge/server` 共用
- 新增 `clientMode=none`，并修正 CORS 开关行为

## 兼容性说明

- 这是一次预发布 breaking change 验证；直接调用旧 bin 名的消费方需要改到新的公开入口
- 如果消费方需要一键启动集成 Web UI，请改用 `@vibe-forge/web`
