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
- `modelServices` 是共享层配置；各 adapter 会按自己的原生运行时做映射：
  - `claude-code` 走 Claude Code Router
  - `codex` 与 `gemini` 走 adapter 自己的本地代理
  - `opencode` 写入 session 级 provider 配置
- 未选择 routed `service,model` 时，adapter 继续使用自己的原生模型/二进制路径。

## 默认内建 MCP

- `vf run` 与 server session 默认都会加载内建 `vibe-forge` MCP server。
- 单次关闭：`npx vf run --no-default-vibe-forge-mcp-server "..."`
- 全局关闭：

```yaml
noDefaultVibeForgeMcpServer: true
```
