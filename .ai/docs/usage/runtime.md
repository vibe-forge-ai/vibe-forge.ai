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

## 从源码开发态启动 UI server / client

这一节只用于 Vibe Forge 仓库自身的前端开发，不推荐作为项目接入方式。项目侧优先使用：

```bash
npx @vibe-forge/web
```

如果你正在 Vibe Forge 源码仓根目录开发 UI，并且已经完成 `pnpm install`，可以执行：

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

说明：

- `vfui-client` 的 `dev` 模式依赖本地源码和 workspace 安装，不再作为 npm 发布包的通用运行方式。
- 非 `dev` 模式下，`@vibe-forge/client` 会直接托管已构建的 `dist`，不再依赖 `vite preview`。

## 说明

- `__VF_PROJECT_WORKSPACE_FOLDER__` 指向你的项目根目录。
- 如果没有显式设置 `__VF_PROJECT_WORKSPACE_FOLDER__`，`@vibe-forge/web`、`@vibe-forge/server`、`vibe-forge-server` 和 `vfui-client` 都会从当前目录向上探测 `.ai`、`.ai.config.*`、`pnpm-workspace.yaml` 或 Git 根目录，并自动把项目根目录作为 workspace。
- 项目配置默认也会跟随这个解析后的 workspace 根目录读取；如果需要单独改配置目录，可以显式设置 `__VF_PROJECT_CONFIG_DIR__`。
- `__VF_PROJECT_AI_BASE_DIR__` 可选；默认是 `.ai`，也可以设成 `.vf` 或 `.config/vibe/ai-data` 之类的嵌套目录。
- `__VF_PROJECT_AI_CACHE_DIR__` 可选；用于覆盖项目级共享 cache 目录。没有显式设置时，Vibe Forge 会把 adapter CLI、skill dependency 等可复用资源放到 workspace 的 `.ai/caches`。
- worktree 场景下，项目级共享 cache 会优先跟随 `__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__`；没有这个环境变量时，会通过 Git worktree 的 common dir 反查主工作树。会话级 cache、mock home 和日志仍然留在当前 worktree。
- `__VF_PROJECT_AI_ENTITIES_DIR__` 可选；默认是 `entities`，会基于 AI 基目录继续解析。

## Adapter CLI 安装与版本

各 adapter 原生 CLI 的托管安装、版本固定、预热与环境变量覆盖见 [Adapter CLI 安装与版本](./adapter-cli.md)。

## Web 登录保护与运行时映射

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
