# @vibe-forge/server 0.10.3

发布日期：2026-04-12

## 发布范围

- 发布 `@vibe-forge/server@0.10.3`

## 主要变更

- channel 初始化现在会把 `connected`、`disabled`、`error` 状态写入启动日志，避免错误只停留在内存状态。
- 对可选的 `@vibe-forge/channel-*/mcp` 入口兼容 `ERR_PACKAGE_PATH_NOT_EXPORTED`，旧发布包缺少 `./mcp` export 时不再把整个 channel 初始化打死。
- channel 初始化失败后会主动回收已创建的连接，避免部分初始化成功后留下脏连接。

## 兼容性说明

- 对外启动参数不变。
- 已有 channel 配置继续兼容，这次主要补强启动期的可观测性和可选 MCP 入口兼容性。
