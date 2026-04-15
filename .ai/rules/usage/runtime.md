# 启动服务

返回入口：[USAGE.md](../USAGE.md)

## 启动 UI server / client

在你的项目根目录执行：

```bash
export __VF_PROJECT_WORKSPACE_FOLDER__="$PWD"
export __VF_PROJECT_AI_BASE_DIR__="${__VF_PROJECT_AI_BASE_DIR__:-.ai}"
export __VF_PROJECT_AI_CLIENT_MODE__="dev"
export HOME="${HOME:-$PWD/${__VF_PROJECT_AI_BASE_DIR__}/.mock}"

npx vfui-server | tee .logs/server.log &
npx vfui-client | tee .logs/client.log &

trap 'kill 0' EXIT
wait
```

## 说明

- `__VF_PROJECT_WORKSPACE_FOLDER__` 指向你的项目根目录。
- `__VF_PROJECT_AI_BASE_DIR__` 可选；默认是 `.ai`，也可以设成 `.vf` 或 `.config/vibe/ai-data` 之类的嵌套目录。
- `__VF_PROJECT_AI_ENTITIES_DIR__` 可选；默认是 `entities`，会基于 AI 基目录继续解析。
- `HOME` 可用于隔离运行环境，默认跟随 AI 基目录落到项目内的 `.mock` 子目录。
- 配置了 `modelServices` 时，adapter 会自动使用 CCR 进行模型服务代理。
- 未配置 `modelServices` 时，adapter 直接使用原生二进制。

## 默认内建 MCP

- `vf run` 与 server session 默认都会加载内建 `VibeForge` MCP server。
- 单次关闭：`npx vf run --no-default-vibe-forge-mcp-server "..."`
- 全局关闭：

```yaml
noDefaultVibeForgeMcpServer: true
```
