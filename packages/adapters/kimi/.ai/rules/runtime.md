# Kimi Runtime

## Session 布局

Kimi adapter 不直接写真实 `~/.kimi`。每个 session 使用独立 share dir：

```text
.ai/caches/<ctxId>/<sessionId>/adapter-kimi/share
```

运行时会设置：

- `KIMI_SHARE_DIR` 指向 session share dir
- `KIMI_CLI_NO_AUTO_UPDATE=1`
- `__VF_KIMI_TASK_SESSION_ID__`
- `__VF_KIMI_HOOK_RUNTIME__`
- `__VF_KIMI_HOOK_MODEL__`

如果真实 Kimi home 有 `credentials`，会软链到 session share dir；如果存在 `config.toml` 或 `config.json`，且本次没有生成新的 model config，会复制一份到 session share dir 再合并托管 hooks。

## Print 模式

稳定命令形态：

```bash
kimi \
  --work-dir "$PWD" \
  --config-file ".ai/caches/.../adapter-kimi/share/config.json" \
  --mcp-config-file ".ai/caches/.../adapter-kimi/share/mcp.json" \
  --skills-dir ".ai/caches/.../adapter-kimi/skills" \
  --print \
  --output-format stream-json \
  --prompt "..."
```

维护要点：

- `--print` 会隐式启用 yolo，不要依赖 Kimi 自带交互审批。
- stdout 是 JSONL，由 [src/runtime/messages.ts](../../src/runtime/messages.ts) 转成 Vibe Forge `ChatMessage`。
- resume 只在 session share dir 下存在 `sessions` 时加 `--continue`。
- `--continue` 与 `--session`/`--resume` 互斥，当前 adapter 没有主动指定 Kimi session id。

## Direct 模式

[src/runtime/direct.ts](../../src/runtime/direct.ts) 只负责把交互式 Kimi 交给终端：

- `stdio: inherit`
- 支持 `--yolo`、`--plan`、`--continue`
- 不解析 stdout 事件

## 安装策略

Kimi CLI 定位优先级：

1. `adapters.kimi.cli.path` 或 `__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__`
2. primary workspace 共享托管 binary：`<primary>/.ai/caches/adapter-kimi/cli/bin/kimi`
3. 系统 `PATH` 里的 `kimi`
4. `autoInstall !== false` 且 `uv` 可用时，执行 `uv tool install --python 3.13 kimi-cli`

用户可通过 `adapters.kimi.cli` 固定版本和安装器：

```yaml
adapters:
  kimi:
    cli:
      source: managed
      package: kimi-cli
      version: 1.36.0
      python: "3.13"
      uvPath: uv
```

旧字段 `autoInstall`、`installPackage`、`installPython`、`uvPath` 继续兼容；新配置优先用 `cli.*`。环境变量覆盖包括：

- `__VF_PROJECT_AI_ADAPTER_KIMI_CLI_SOURCE__`
- `__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__`
- `__VF_PROJECT_AI_ADAPTER_KIMI_AUTO_INSTALL__`
- `__VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PACKAGE__`
- `__VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_VERSION__`
- `__VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PYTHON__`
- `__VF_PROJECT_AI_ADAPTER_KIMI_UV_PATH__`

官方安装脚本适合提示用户手动执行：

```bash
curl -LsSf https://code.kimi.com/install.sh | bash
```

adapter 内部不直接执行官方脚本，因为它会修改用户级环境和 PATH。自动安装必须保持在共享 cache 的 `adapter-kimi/cli` 下，避免污染真实 home。

worktree 场景下，CLI 安装 cache 跟随 primary workspace：优先使用 `__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__`，没有 env hint 时通过 `git rev-parse --git-common-dir` 反查主工作树。session share dir 仍然留在当前 worktree 的 `.ai/caches/<ctxId>/<sessionId>/adapter-kimi/share`，不要和 CLI cache 混用。

没有 `kimi` 或 `uv` 时，错误信息要继续包含：

- 官方 Kimi installer，macOS/Linux 与 Windows PowerShell 两种命令
- uv installer、Homebrew `brew install uv`
- 手动 `uv tool install --python <version> kimi-cli`
- `__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH=/absolute/path/to/kimi`
