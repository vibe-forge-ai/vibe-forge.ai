我将修改 CLI，使其默认行为是执行 `run` 指令，而不是注册为子命令，同时支持流式（stream）和直接（direct/print）两种模式。

### 1. 更新 Claude Code Adapter
修改 `packages/adapters/claude-code/src/index.ts`：
- 在 `direct` 模式下，为生成的子进程添加 `exit` 事件监听。
- 通过 `onEvent` 发送 `exit` 事件，以便调用者知道进程何时结束。

### 2. 实现默认 Run 逻辑
修改 `apps/cli/src/cli.ts`：
- 不再将 `run` 注册为 `program.command('run')`。
- 直接在根命令 `program` 上定义选项（Options）：
  - `--print`: 启用 `direct` 模式（直接在控制台交互）。
  - `--model <model>`: 指定模型。
  - `--adapter <adapter>`: 指定适配器（默认：`claude-code`）。
  - `--system-prompt <prompt>`: 系统提示词。
- 使用 `program.action()` 定义默认行为：
  - 调用 `@vibe-forge/core/controllers/task` 中的 `run` 方法。
  - 使用 `Promise` 包装执行过程，等待适配器发送 `exit` 事件后再结束 CLI 进程。
  - 如果未开启 `--print`（即 `stream` 模式），将接收到的事件以 JSON 字符串形式打印到标准输出。

### 3. 保留现有 MCP 指令
- `mcp` 指令保持不变，作为子命令存在。

### 实施步骤
1.  **编辑 `packages/adapters/claude-code/src/index.ts`**，处理 direct 模式下的退出事件。
2.  **编辑 `apps/cli/src/cli.ts`**，在根命令上添加选项并设置默认 Action 为运行 Task。
