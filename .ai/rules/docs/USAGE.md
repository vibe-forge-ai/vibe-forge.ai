# 在自己项目中使用

本指南说明如何把 Vibe Forge 作为外部工具接入你的项目，步骤参考了仓库的启动脚本逻辑。

## 安装与准备

1. 在你的项目中安装所需包（无需 clone 本仓库）：

   ```bash
   pnpm add -D @vibe-forge/server @vibe-forge/client @vibe-forge/cli @vibe-forge/adapter-claude-code
   ```

   如果你想显式调用独立 `vf-mcp` 二进制，额外安装：

   ```bash
   pnpm add -D @vibe-forge/mcp
   ```

   如果你想显式调用独立 `vf-call-hook` 二进制，额外安装：

   ```bash
   pnpm add -D @vibe-forge/hooks
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
   - 如果使用 TS 配置，`defineConfig()` 入口位于 `@vibe-forge/config`，对应的 `Config` 类型位于 `@vibe-forge/types`

## 启动服务（连接到你的项目）

在你的项目根目录执行（推荐放到脚本里），启动 UI server/client：

```bash
export HOME="${HOME:-$PWD/.ai/.mock}"
export __VF_PROJECT_WORKSPACE_FOLDER__="$PWD"
export __VF_PROJECT_AI_CLIENT_MODE__="dev"

npx vfui-server | tee .logs/server.log &
npx vfui-client | tee .logs/client.log &

trap 'kill 0' EXIT
wait
```

说明：

- `__VF_PROJECT_WORKSPACE_FOLDER__` 指向你的项目根目录，配置与会话将基于该目录。
- `HOME` 可用于隔离运行环境（默认用项目内的 `./.ai/.mock`），按需替换或移除。
- 当配置了 `modelServices` 时，adapter 会自动使用 CCR（`node_modules/.bin/ccr`）进行模型服务代理。未配置时则直接使用原生 `claude` 二进制。

## CLI 使用

安装依赖后可直接使用 `vf`：

```bash
npx vf run --help
npx vf-mcp --help
```

常用子命令：

- `vf run`：运行一次任务（支持指定 adapter/model/systemPrompt/tools/mcpServers/skills 等参数）
- `vf-mcp`：启动独立的 MCP stdio server
- `vf-call-hook`：从标准输入读取 hook payload 并执行共享 hooks runtime，通常用于 native hook / bridge 排查
- `vf list` / `vf ls`：列出历史任务缓存
- `vf clear`：清理本地日志与缓存
- `vf stop <ctxId>`：优雅停止任务
- `vf kill <ctxId>`：强制终止任务

## 默认内建 MCP

`vf run` 与 server session 默认都会加载内建 `vibe-forge` MCP server。
这个内建 server 由 `@vibe-forge/config` 负责解析、由 task runtime 在 prepare 阶段注入；应用侧通过 `@vibe-forge/app-runtime` 携带 `@vibe-forge/mcp` 安装锚点，因此安装 `@vibe-forge/cli` 或 `@vibe-forge/server` 时会随任务运行时一起获得默认内建 MCP 能力。

如果你是单独安装 `@vibe-forge/mcp` 来运行 `vf-mcp`，默认也会带上 `@vibe-forge/task` 提供的 task tools。

单次关闭：

```bash
npx vf run --no-default-vibe-forge-mcp-server "帮我检查最近的构建失败原因"
```

全局关闭：

```yaml
noDefaultVibeForgeMcpServer: true
```

如果只是想控制默认启用/禁用的 MCP server 名单，继续使用：

- `defaultIncludeMcpServers`
- `defaultExcludeMcpServers`
- `mcpServers.include / exclude`

如果你不希望 CLI 注入 Vibe Forge 自动生成的默认 system prompt（例如 rules / skills / entities / specs 生成的提示词），可以：

- 单次执行时传 `vf run --no-inject-default-system-prompt`
- 或在配置文件中设置：

```yaml
conversation:
  injectDefaultSystemPrompt: false
```

这个开关不会影响你手动传入的 `--system-prompt`，只会关闭 CLI 自动拼接的默认提示词。

## 参考示例

1. 启动 UI server / client：

   ```bash
   npx vfui-server
   npx vfui-client
   ```

2. 启动独立 MCP server：

   ```bash
   npx vf-mcp --include-category general,task
   ```

3. 直接调试 hooks runtime：

   ```bash
   printf '%s\n' '{"hookEventName":"Notification","cwd":"'"$PWD"'","sessionId":"debug-hook"}' | npx vf-call-hook
   ```

4. 执行一次带默认内建 MCP 的任务：

   ```bash
   npx vf run --adapter codex --print "读取 README 并给出一个三步改进建议"
   ```

5. 执行一次显式关闭默认内建 MCP 的任务：

   ```bash
   npx vf run --adapter codex --no-default-vibe-forge-mcp-server --print "只用本地工具完成一次代码审查"
   ```
