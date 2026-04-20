# @vibe-forge/web 3.0.0-alpha.0

发布日期：2026-04-21

## 发布范围

- 首次发布 `@vibe-forge/web@3.0.0-alpha.0`

## 主要变更

- 提供单进程集成 Web 入口，对外统一暴露 `vibe-forge-web`
- 默认托管内置前端静态资源，并输出一个前端访问地址
- 支持 `--host`、`--port`、`--base`、`--workspace`、`--config-dir`、`--data-dir`、`--log-dir`、`--public-base-url`

## 兼容性说明

- 当前默认 UI base 仍为 `/ui`
- 该包用于替代旧的“server 进程 + client dist 注入”式 UI 启动方式
