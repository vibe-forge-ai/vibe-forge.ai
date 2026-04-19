# CLI 与示例

返回入口：[index.md](../index.md)

## 常用命令

通过 Homebrew 安装后可以直接使用 `vf`；不安装到项目依赖时，用 `npx -p <package> <bin>` 临时运行对应命令。

- `vf run --help`
- `npx -y -p @vibe-forge/cli vf run --help`
- `npx -y -p @vibe-forge/mcp vf-mcp --help`
- `vf run`：执行一次任务
- `vf --resume <sessionId>`：恢复已有 CLI 会话，固定参数和已解析 adapter 都从 `.ai/caches/` 对应会话读取
- `vf-mcp`：启动独立 MCP stdio server
- `vf-call-hook`：从标准输入读取 hook payload 并执行 hooks runtime
- `vf list` / `vf ls`：以 compact 视图列出历史任务缓存
- `vf list --view default`：展示 adapter / model 等常用列
- `vf list --view full`：展示上下文、PID 与辅助命令列
- `vf list --running`：只看当前仍在运行的 CLI 会话
- `vf clear`：清理本地日志与缓存
- `vf stop <sessionId>`：优雅停止正在运行的 CLI 会话
- `vf kill <sessionId>`：强制终止正在运行的 CLI 会话
- `vf config list [path]`：查看配置 section 状态，或读取某个配置子树
- `vf config get [path]`：读取配置值
- `vf config set [path] [value]`：写入配置值
- `vf config unset [path]`：删除配置值

这些命令默认以项目根目录作为 workspace。

- 如果显式设置了 `__VF_PROJECT_WORKSPACE_FOLDER__`，会直接使用该目录。
- 如果没有设置，`vf` / `vf-mcp` / `vf-call-hook` / `vfui-server` / `vfui-client` 会从当前目录向上探测 `.ai`、`.ai.config.*`、`pnpm-workspace.yaml` 或 Git 根目录，因此可以在项目任意子目录下启动。
- 配置文件默认会跟随这个解析后的 workspace 根目录读取；如果需要把 `.ai.config.*` 放到别的目录，可以显式设置 `__VF_PROJECT_CONFIG_DIR__`。

## 内建 Skills

`@vibe-forge/cli` 会默认注入 companion 插件 `@vibe-forge/plugin-cli-skills`，可直接通过 `--include-skill` 使用：

- `vf-cli-quickstart`：介绍 `vf run`、`vf list`、`vf --resume`、`vf stop`、`vf kill`，以及 `vf config list|get|set|unset` 的基本用法和输出语义。
- `vf-cli-print-mode`：介绍 `--print`、`--input-format`、权限请求、继续会话和 `submit_input` 的写法。

示例：

```bash
vf run --include-skill vf-cli-quickstart "介绍一下 vf CLI 怎么恢复一个会话"
vf run --include-skill vf-cli-print-mode --print "告诉我 print 模式怎么处理权限请求"
```

## 参考示例

### 启动 UI

```bash
npx -y -p @vibe-forge/server vfui-server
npx -y -p @vibe-forge/client vfui-client
```

### 启动独立 MCP

```bash
npx -y -p @vibe-forge/mcp vf-mcp --include-category general,task
```

### 调试 hooks runtime

```bash
printf '%s\n' '{"hookEventName":"Notification","cwd":"'"$PWD"'","sessionId":"debug-hook"}' | npx -y -p @vibe-forge/hooks vf-call-hook
```

### 执行一次任务

```bash
vf run -A codex --print "读取 README 并给出一个三步改进建议"
vf run -A claude "读取 README 并给出一个三步改进建议"
vf run --workspace billing "修复订单状态回滚问题"
```

`adapter` 参数支持 `-A` 短写，也接受常见简化值，例如 `claude`、`adapter-codex`。

### 指定 workspace

大型仓库可在 `.ai.config.json` 声明 `workspaces`。指定 `--workspace <id>` 后，任务会在对应 workspace 目录下启动，并使用该目录自己的配置与数据资产。

```bash
vf run --workspace billing "修复订单状态回滚问题"
```

更多配置见 [Workspace 调度](./workspaces.md)。

### 恢复会话

```bash
vf list
vf list --view default
vf list --view full
vf --resume <sessionId>
```

### 读取配置

```bash
vf config list
vf config get general.defaultModel
vf config get models
vf config get modelServices.gpt-responses.models
```

说明：

- `vf config list` / `vf config get` 默认读取 merged config；只有显式传 `--source project|user|all` 才切换来源。
- 文本模式默认输出 YAML，适合直接阅读；`--json` 保留结构化原始结果，适合脚本消费。
- `vf config get models` 和 `vf config list models` 在文本模式下会按 `modelServices` 展开成 `service -> models` 视图，并把 `models` 里的 metadata 合进去，避免把稀疏 metadata map 误看成完整模型列表。
- 如果需要看原始 `models` metadata 结构，使用 `--json`。
