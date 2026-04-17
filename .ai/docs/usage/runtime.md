# 启动服务

返回入口：[index.md](../index.md)

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
- 如果没有显式设置 `__VF_PROJECT_WORKSPACE_FOLDER__`，`vfui-server` / `vfui-client` 会从当前目录向上探测 `.ai`、`.ai.config.*`、`pnpm-workspace.yaml` 或 Git 根目录，并自动把项目根目录作为 workspace。
- `__VF_PROJECT_AI_BASE_DIR__` 可选；默认是 `.ai`，也可以设成 `.vf` 或 `.config/vibe/ai-data` 之类的嵌套目录。
- `__VF_PROJECT_AI_ENTITIES_DIR__` 可选；默认是 `entities`，会基于 AI 基目录继续解析。
- `HOME` 可用于隔离运行环境，默认跟随 AI 基目录落到项目内的 `.mock` 子目录。
- `modelServices` 是共享层配置；各 adapter 会按自己的原生运行时做映射，具体以对应 adapter 文档为准。
  - 例如 `claude-code` 走 Claude Code Router
  - `codex` 与 `gemini` 走 adapter 自己的本地代理
  - 部分 adapter 会把 provider 配置写进 session 级或原生配置文件
- 未选择 routed `service,model` 时，adapter 继续使用自己的原生模型/二进制路径。

## 默认内建 MCP

- `vf run` 与 server session 默认都会加载内建 `VibeForge` MCP server。
- 单次关闭：`npx vf run --no-default-vibe-forge-mcp-server "..."`
- 全局关闭：

```yaml
noDefaultVibeForgeMcpServer: true
```
