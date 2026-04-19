# 安装与准备

返回入口：[index.md](../index.md)

## 安装基础包

### Homebrew 安装 CLI

如果只需要 `vf` CLI，可以通过 Homebrew 安装和更新：

```bash
brew install vibe-forge-ai/tap/vibe-forge
```

更新：

```bash
brew update
brew upgrade vibe-forge
```

当前 Homebrew formula 安装 `@vibe-forge/cli`，会暴露 `vf`、`vforge` 和 `vibe-forge` 三个命令。

### Windows 安装 CLI

Windows 可以用 PowerShell 一键安装最新 CLI。脚本会检查 Node.js 22+ / npm；如果缺失，会优先通过 winget 安装 Node.js LTS，其次尝试 Scoop：

```powershell
irm https://raw.githubusercontent.com/vibe-forge-ai/vibe-forge.ai/master/scripts/install-windows.ps1 | iex
```

如果你的 PowerShell 执行策略较严格，先下载再执行：

```powershell
iwr https://raw.githubusercontent.com/vibe-forge-ai/vibe-forge.ai/master/scripts/install-windows.ps1 -OutFile install-vibe-forge.ps1
powershell -ExecutionPolicy Bypass -File .\install-vibe-forge.ps1
```

安装完成后可以直接检查：

```powershell
vf --version
vf run --help
```

如果已经安装 Scoop，也可以通过 Vibe Forge 的 bucket 安装和更新：

```powershell
scoop bucket add vibe-forge https://github.com/vibe-forge-ai/scoop-bucket
scoop install vibe-forge
```

更新：

```powershell
scoop update
scoop update vibe-forge
```

winget 的公开安装命令会在 manifest 被 `microsoft/winget-pkgs` 接受后可用：

```powershell
winget install --id VibeForge.VibeForge -e
```

在此之前，Windows 用户优先使用 PowerShell 脚本或 Scoop。

### 在项目中安装 npm 包

```bash
pnpm add -D @vibe-forge/server @vibe-forge/client @vibe-forge/cli @vibe-forge/adapter-claude-code
```

如果需要在项目里启用插件，还需要把对应插件包一起安装到当前 workspace：

```bash
pnpm add -D @vibe-forge/plugin-standard-dev @vibe-forge/plugin-logger
```

如果你想显式调用独立 `vf-mcp` 二进制：

```bash
pnpm add -D @vibe-forge/mcp
```

如果你想显式调用独立 `vf-call-hook` 二进制：

```bash
pnpm add -D @vibe-forge/hooks
```

不想写入依赖也可以直接用 `npx`：

```bash
npx -y -p @vibe-forge/server vfui-server --help
npx -y -p @vibe-forge/client vfui-client --help
```

## 配置文件

默认情况下，Vibe Forge 会把解析后的 workspace 根目录作为项目配置根目录。

- 如果显式设置了 `__VF_PROJECT_WORKSPACE_FOLDER__`，直接使用该目录。
- 如果没有设置，会从当前启动目录向上探测 `.ai`、`.ai.config.*`、`pnpm-workspace.yaml` 或 Git 根目录。

在这个配置根目录准备：

- `.ai.config.json` / `.ai.config.yaml` / `.ai.config.yml`
- 可选开发态配置：`.ai.dev.config.*`
- 同名配置也可放在 `./infra/` 下

如果你希望把配置文件放到别的目录，可以额外在启动环境里设置：

```env
__VF_PROJECT_CONFIG_DIR__=.config/vibe
```

`__VF_PROJECT_CONFIG_DIR__` 支持：

- 相对启动目录（launch cwd）的路径
- 绝对路径

配置支持 `${ENV_VAR}` 变量替换。使用 TS 配置时：

- `defineConfig()` 入口：`@vibe-forge/config`
- `Config` 类型：`@vibe-forge/types`

## 数据资产目录

默认情况下，项目数据资产目录位于 `./.ai/`，例如：

- `./.ai/rules`
- `./.ai/skills`
- `./.ai/specs`
- `./.ai/entities`
- `./.ai/mcp`

如果你希望改名或放到嵌套目录，可以在项目根 `.env` 中覆盖：

```env
__VF_PROJECT_AI_BASE_DIR__=.vf
__VF_PROJECT_AI_ENTITIES_DIR__=agents
```

常见用法：

- `__VF_PROJECT_AI_BASE_DIR__`：覆盖整个数据资产根目录，支持相对项目根的嵌套目录，也支持绝对路径
- `__VF_PROJECT_AI_ENTITIES_DIR__`：只覆盖实体子目录，基于 AI 基目录继续解析，也支持嵌套路径

例如：

```env
__VF_PROJECT_AI_BASE_DIR__=.config/vibe/ai-data
__VF_PROJECT_AI_ENTITIES_DIR__=knowledge/entities
```

最终实体目录会解析为 `./.config/vibe/ai-data/knowledge/entities`。

注意：

- `__VF_PROJECT_AI_BASE_DIR__` / `__VF_PROJECT_AI_ENTITIES_DIR__` 只影响数据资产目录，不改变配置文件文件名与位置
- 配置文件默认仍然位于解析后的 workspace 根目录或其 `./infra/` 下；只有显式设置 `__VF_PROJECT_CONFIG_DIR__` 时才会改到别的目录
- 修改 `.env` 后需要重启相关 server / CLI / adapter 进程，已有进程不会自动重载
