# 启动服务

返回入口：[index.md](../index.md)

## 启动 Web UI

推荐直接在项目根目录执行：

```bash
npx @vibe-forge/web
```

默认会：

- 自动解析当前 workspace 根目录
- 启动一个内置 server
- 托管内置 Web UI
- 输出一个前端访问地址，默认是 `http://127.0.0.1:8787/ui/`

常用参数：

```bash
npx @vibe-forge/web --host 127.0.0.1 --port 8787
npx @vibe-forge/web --workspace /path/to/project --config-dir /path/to/project/infra
```

## 启动 headless server

如果你要让独立 PWA、静态站点或其他 app 连接当前项目，执行：

```bash
npx @vibe-forge/server
```

默认只暴露控制面服务，不挂载 Web UI。常用参数：

```bash
npx @vibe-forge/server --host 127.0.0.1 --port 8787
npx @vibe-forge/server --host 0.0.0.0 --port 8787 --allow-cors
```

## 开发态启动 UI server / client

在你的项目根目录执行：

```bash
export __VF_PROJECT_WORKSPACE_FOLDER__="$PWD"
export __VF_PROJECT_AI_BASE_DIR__="${__VF_PROJECT_AI_BASE_DIR__:-.ai}"
export __VF_PROJECT_AI_CLIENT_MODE__="dev"
export HOME="${HOME:-$PWD/${__VF_PROJECT_AI_BASE_DIR__}/.mock}"

npx -y -p @vibe-forge/server vibe-forge-server | tee .logs/server.log &
npx -y -p @vibe-forge/client vfui-client | tee .logs/client.log &

trap 'kill 0' EXIT
wait
```

## 说明

- `__VF_PROJECT_WORKSPACE_FOLDER__` 指向你的项目根目录。
- 如果没有显式设置 `__VF_PROJECT_WORKSPACE_FOLDER__`，`@vibe-forge/web`、`@vibe-forge/server`、`vibe-forge-server` 和 `vfui-client` 都会从当前目录向上探测 `.ai`、`.ai.config.*`、`pnpm-workspace.yaml` 或 Git 根目录，并自动把项目根目录作为 workspace。
- 项目配置默认也会跟随这个解析后的 workspace 根目录读取；如果需要单独改配置目录，可以显式设置 `__VF_PROJECT_CONFIG_DIR__`。
- `__VF_PROJECT_AI_BASE_DIR__` 可选；默认是 `.ai`，也可以设成 `.vf` 或 `.config/vibe/ai-data` 之类的嵌套目录。
- `__VF_PROJECT_AI_CACHE_DIR__` 可选；用于覆盖项目级共享 cache 目录。没有显式设置时，Vibe Forge 会把 adapter CLI、skill dependency 等可复用资源放到 workspace 的 `.ai/caches`。
- worktree 场景下，项目级共享 cache 会优先跟随 `__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__`；没有这个环境变量时，会通过 Git worktree 的 common dir 反查主工作树。会话级 cache、mock home 和日志仍然留在当前 worktree。
- `__VF_PROJECT_AI_ENTITIES_DIR__` 可选；默认是 `entities`，会基于 AI 基目录继续解析。

## Adapter CLI 安装与版本

Vibe Forge 不把各原生 CLI 作为 adapter 包的运行时依赖。第一次使用时，adapter 会优先找显式配置的 binary、项目共享 cache、系统 `PATH`，都不可用时再安装到项目级共享 cache：

- npm 托管：`codex`、`gemini`、`copilot`、`opencode`、`claude-code.cli`、`claude-code.routerCli`
- uv 托管：`kimi.cli`

默认托管版本：

| Adapter                 | 托管包                           | 默认版本  |
| ----------------------- | -------------------------------- | --------- |
| `codex`                 | `@openai/codex`                  | `0.121.0` |
| `gemini`                | `@google/gemini-cli`             | `0.38.2`  |
| `copilot`               | `@github/copilot`                | `1.0.32`  |
| `opencode`              | `opencode-ai`                    | `1.14.18` |
| `claude-code.cli`       | `@anthropic-ai/claude-code`      | `2.1.114` |
| `claude-code.routerCli` | `@musistudio/claude-code-router` | `1.0.73`  |
| `kimi.cli`              | `kimi-cli`                       | `1.36.0`  |

可以在项目配置里固定来源和版本：

```yaml
adapters:
  codex:
    cli:
      source: managed
      version: 0.121.0
      prepareOnInstall: true
  claude-code:
    cli:
      version: 2.1.114
    routerCli:
      version: 1.0.73
  kimi:
    cli:
      package: kimi-cli
      version: 1.36.0
      python: "3.13"
```

`cli.source` 支持：

- `managed`：使用项目共享 cache 中的托管 CLI；缺失时按 `autoInstall` 安装
- `system`：优先使用系统 `PATH` 中的原生命令；缺失时仍可按 `autoInstall` 安装
- `path`：只使用 `cli.path` 指向的 binary

把 `autoInstall` 设为 `false` 可以关闭首次使用时的自动安装。npm 托管 adapter 还支持 `cli.package`、`cli.npmPath`；Kimi 支持 `cli.package`、`cli.python`、`cli.uvPath`。

如果希望提前把托管 CLI 下载到项目共享 cache，可以显式运行：

```bash
vf adapter prepare codex claude-code gemini
vf adapter prepare claude-code.routerCli
vf adapter prepare --all
```

不传 target 时，`vf adapter prepare` 只准备配置中声明了 `prepareOnInstall: true` 的 CLI：

```json
{
  "adapters": {
    "codex": {
      "cli": {
        "source": "managed",
        "version": "0.121.0",
        "prepareOnInstall": true
      }
    },
    "claude-code": {
      "routerCli": {
        "version": "1.0.73",
        "prepareOnInstall": true
      }
    }
  }
}
```

`@vibe-forge/cli` 的 package `postinstall` 也会读取项目根的 `.ai.config.json` 或 `infra/.ai.config.json`。只有发现上述 `prepareOnInstall: true` 时才会调用 `vf adapter prepare --from-postinstall`，否则不做网络下载。postinstall 默认跳过 `CI=true`；如需在 CI 里预热，设置 `VIBE_FORGE_POSTINSTALL_PREPARE=1`。如需跳过，设置 `VIBE_FORGE_SKIP_ADAPTER_PREPARE=1` 或 `VIBE_FORGE_SKIP_POSTINSTALL=1`。

同样可以用环境变量临时覆盖，`<ADAPTER>` 使用大写下划线，例如 `CODEX`、`GEMINI`、`CLAUDE_CODE`、`CLAUDE_CODE_ROUTER`：

```bash
export __VF_PROJECT_AI_ADAPTER_CODEX_CLI_SOURCE__=managed
export __VF_PROJECT_AI_ADAPTER_CODEX_INSTALL_VERSION__=0.121.0
export __VF_PROJECT_AI_ADAPTER_CODEX_AUTO_INSTALL__=false
export __VF_PROJECT_AI_ADAPTER_CODEX_CLI_PATH__=/absolute/path/to/codex

export __VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_VERSION__=1.36.0
export __VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PYTHON__=3.13
export __VF_PROJECT_AI_ADAPTER_KIMI_UV_PATH__=/absolute/path/to/uv
```

- Web UI 在 server 绑定到 `localhost`、`127.*`、`::1` 时默认不启用登录保护；绑定到 `0.0.0.0`、局域网 IP 或域名时默认启用。可以在项目配置中设置多个账号：

```yaml
webAuth:
  enabled: true
  rememberDeviceTtlDays: 30
  accounts:
    - username: alice
      password: change-me
    - username: bob
      password: change-me-too
```

- 如果没有配置 `webAuth.accounts` 或 `webAuth.password`，server 会在数据目录生成 `web-auth-password`，默认账号是 `admin`。默认数据目录是 `.data/`，仓库已忽略该目录，不会提交。
- 临时关闭登录保护：

```yaml
webAuth:
  enabled: false
```

- `HOME` 可用于隔离运行环境，默认跟随 AI 基目录落到项目内的 `.mock` 子目录。
- `modelServices` 是共享层配置；各 adapter 会按自己的原生运行时做映射，具体以对应 adapter 文档为准。
  - 例如 `claude-code` 走 Claude Code Router
  - `codex` 与 `gemini` 走 adapter 自己的本地代理
  - 部分 adapter 会把 provider 配置写进 session 级或原生配置文件
- 未选择 routed `service,model` 时，adapter 继续使用自己的原生模型/二进制路径。

## 默认内建 MCP

- `vf run` 与 server session 默认都会加载内建 `VibeForge` MCP server。
- 单次关闭：`vf run --no-default-vibe-forge-mcp-server "..."`
- 全局关闭：

```yaml
noDefaultVibeForgeMcpServer: true
```
