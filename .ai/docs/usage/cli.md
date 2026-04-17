# CLI 与示例

返回入口：[index.md](../index.md)

## 常用命令

- `npx vf run --help`
- `npx vf-mcp --help`
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

这些命令默认以项目根目录作为 workspace。

- 如果显式设置了 `__VF_PROJECT_WORKSPACE_FOLDER__`，会直接使用该目录。
- 如果没有设置，`vf` / `vf-mcp` / `vf-call-hook` / `vfui-server` / `vfui-client` 会从当前目录向上探测 `.ai`、`.ai.config.*`、`pnpm-workspace.yaml` 或 Git 根目录，因此可以在项目任意子目录下启动。
- 配置文件默认会跟随这个解析后的 workspace 根目录读取；如果需要把 `.ai.config.*` 放到别的目录，可以显式设置 `__VF_PROJECT_CONFIG_DIR__`。

## 内建 Skills

`@vibe-forge/cli` 会默认注入 companion 插件 `@vibe-forge/plugin-cli-skills`，可直接通过 `--include-skill` 使用：

- `vf-cli-quickstart`：介绍 `vf run`、`vf list`、`vf --resume`、`vf stop`、`vf kill` 等常用命令。
- `vf-cli-print-mode`：介绍 `--print`、`--input-format`、权限请求、继续会话和 `submit_input` 的写法。

示例：

```bash
npx vf run --include-skill vf-cli-quickstart "介绍一下 vf CLI 怎么恢复一个会话"
npx vf run --include-skill vf-cli-print-mode --print "告诉我 print 模式怎么处理权限请求"
```

## 参考示例

### 启动 UI

```bash
npx vfui-server
npx vfui-client
```

### 启动独立 MCP

```bash
npx vf-mcp --include-category general,task
```

### 调试 hooks runtime

```bash
printf '%s\n' '{"hookEventName":"Notification","cwd":"'"$PWD"'","sessionId":"debug-hook"}' | npx vf-call-hook
```

### 执行一次任务

```bash
npx vf run -A codex --print "读取 README 并给出一个三步改进建议"
npx vf run -A claude "读取 README 并给出一个三步改进建议"
```

`adapter` 参数支持 `-A` 短写，也接受常见简化值，例如 `claude`、`adapter-codex`。

### 恢复会话

```bash
npx vf list
npx vf list --view default
npx vf list --view full
npx vf --resume <sessionId>
```
