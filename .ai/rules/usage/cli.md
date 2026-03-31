# CLI 与示例

返回入口：[USAGE.md](../USAGE.md)

## 常用命令

- `npx vf run --help`
- `npx vf-mcp --help`
- `vf run`：执行一次任务
- `vf-mcp`：启动独立 MCP stdio server
- `vf-call-hook`：从标准输入读取 hook payload 并执行 hooks runtime
- `vf list` / `vf ls`：列出历史任务缓存
- `vf clear`：清理本地日志与缓存
- `vf stop <ctxId>`：优雅停止任务
- `vf kill <ctxId>`：强制终止任务

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
npx vf run --adapter codex --print "读取 README 并给出一个三步改进建议"
```
