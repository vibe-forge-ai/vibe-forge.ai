# 启动服务

返回入口：[USAGE.md](../USAGE.md)

## 启动 UI server / client

在你的项目根目录执行：

```bash
export HOME="${HOME:-$PWD/.ai/.mock}"
export __VF_PROJECT_WORKSPACE_FOLDER__="$PWD"
export __VF_PROJECT_AI_CLIENT_MODE__="dev"

npx vfui-server | tee .logs/server.log &
npx vfui-client | tee .logs/client.log &

trap 'kill 0' EXIT
wait
```

## 说明

- `__VF_PROJECT_WORKSPACE_FOLDER__` 指向你的项目根目录。
- `HOME` 可用于隔离运行环境，默认用项目内的 `./.ai/.mock`。
- 配置了 `modelServices` 时，adapter 会自动使用 CCR 进行模型服务代理。
- 未配置 `modelServices` 时，adapter 直接使用原生二进制。

## 默认内建 MCP

- `vf run` 与 server session 默认都会加载内建 `VibeForge` MCP server。
- 单次关闭：`npx vf run --no-default-vibe-forge-mcp-server "..."`
- 全局关闭：

```yaml
noDefaultVibeForgeMcpServer: true
```
