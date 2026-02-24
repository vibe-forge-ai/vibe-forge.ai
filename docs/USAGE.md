# 在自己项目中使用

本指南说明如何把 Vibe Forge 作为外部工具接入你的项目，步骤参考了仓库的启动脚本逻辑。

## 安装与准备

1. 在你的项目中安装所需包（无需 clone 本仓库）：

   ```bash
   pnpm add -D @vibe-forge/server @vibe-forge/client @vibe-forge/cli @vibe-forge/adapter-claude-code
   ```

   不想写入依赖也可以直接用 npx 运行（会临时下载）：

   ```bash
   npx -y vfui-server --help
   npx -y vfui-client --help
   ```

2. 在你的项目根目录准备配置文件：

   - `.ai.config.json` / `.ai.config.yaml` / `.ai.config.yml`
   - 可选开发态配置：`.ai.dev.config.*`
   - 同名配置也可放在 `./infra/` 下
   - 配置项支持 `${ENV_VAR}` 变量替换

## 启动服务（连接到你的项目）

在你的项目根目录执行（推荐放到脚本里），启动 UI server/client：

```bash
export HOME="${HOME:-$PWD/.ai/.mock}"
export __VF_PROJECT_WORKSPACE_FOLDER__="$PWD"
export __VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_PATH__="$PWD/node_modules/.bin/ccr"
export __VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_ARGS__="code"
export IS_LOCAL_DEV="true"

npx vfui-server | tee .logs/server.log &
npx vfui-client | tee .logs/client.log &

trap 'kill 0' EXIT
wait
```

说明：

- `__VF_PROJECT_WORKSPACE_FOLDER__` 指向你的项目根目录，配置与会话将基于该目录。
- `HOME` 可用于隔离运行环境（默认用项目内的 `./.ai/.mock`），按需替换或移除。
- `__VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_PATH__` 指向 `ccr` 可执行文件（通常来自依赖 `@musistudio/claude-code-router`，随 `@vibe-forge/adapter-claude-code` 一起安装到 `node_modules/.bin`）。

## CLI 使用

安装依赖后可直接使用 `vf`：

```bash
npx vf mcp
npx vf run --help
```

常用子命令：

- `vf run`：运行一次任务（支持指定 adapter/model/systemPrompt/tools/mcpServers/skills 等参数）
- `vf mcp`：启动 MCP stdio server
- `vf list` / `vf ls`：列出历史任务缓存
- `vf clear`：清理本地日志与缓存
- `vf stop <ctxId>`：优雅停止任务
- `vf kill <ctxId>`：强制终止任务
