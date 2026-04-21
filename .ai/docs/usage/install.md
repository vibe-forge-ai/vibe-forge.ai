# 安装与准备

返回入口：[index.md](../index.md)

## 安装基础包

### 下载桌面应用

如果你想直接使用桌面版 Vibe Forge，而不是先在项目里拼装 `server + client`：

- 从 [GitHub Releases](https://github.com/vibe-forge-ai/vibe-forge.ai/releases) 下载 `desktop-v*` tag 对应的安装包
- macOS：Intel（`x64`）与 Apple Silicon（`arm64`）分别提供 `.dmg`、`.zip`
- Windows：正式安装包暂未提供，后续补发见 [#161](https://github.com/vibe-forge-ai/vibe-forge.ai/issues/161)
- Linux：`.AppImage`、`.deb`、`.tar.gz`

注意：

- 当前桌面 release / CI artifact 默认不签名
- 第一次启动时，macOS 可能会弹出系统安全提示，需要手动确认

### 最小入口

如果你只想快速跑起来，优先使用这两个入口：

```bash
npx @vibe-forge/bootstrap run "summarize the repo"
npx @vibe-forge/bootstrap web
npx @vibe-forge/bootstrap server
npx @vibe-forge/bootstrap app
npx @vibe-forge/bootstrap app cache
npx @vibe-forge/bootstrap app --no-cache
```

`@vibe-forge/bootstrap` 会按需懒安装对应运行时：

- `web`：转发到 `@vibe-forge/web`
- `server`：转发到 `@vibe-forge/server`
- `app`：记住上次桌面安装模式；如果没有记录，会先询问是装到用户目录还是 bootstrap cache，再以当前目录作为 workspace 启动桌面应用
- `app cache`：显式走 cache；如果 cache 里已经有对应 release，就直接从 cache 启动
- `app --no-cache`：显式回到用户目录安装模式
- 其他命令：原样转发到 `@vibe-forge/cli`

其中 `bootstrap app` 依赖对应平台已经公开发布桌面 release；当前 macOS、Linux 可用，Windows 仍以正式安装产物补齐为准。

`bootstrap app` 的项目行为：

- 当前命令所在目录会传给桌面应用作为 workspace
- 如果桌面应用已经在运行，同一目录会直接聚焦已有项目窗口，不会重复启动本机 service
- 如果桌面应用已经在运行，但当前目录是另一个项目，会在同一个 desktop 进程里为新目录启动独立 service，并打开新的项目窗口

如果你直接从安装包启动桌面应用，而不是从项目目录运行 `bootstrap app`，桌面端会先要求选择一个最近项目或手动打开目录，确保后续流程一定在某个 workspace 下继续。

如果你不想经过 bootstrap，也可以直接使用具体入口：

```bash
npx @vibe-forge/web
npx @vibe-forge/server
```

- `@vibe-forge/web`：单进程启动内置 Web UI，默认访问地址是 `http://127.0.0.1:8787/ui/`
- `@vibe-forge/server`：只启动控制面服务，供独立 PWA、静态 Web 或其他 app 连接

常用参数：

```bash
npx @vibe-forge/web --host 127.0.0.1 --port 8787
npx @vibe-forge/server --host 0.0.0.0 --port 8787 --allow-cors
```

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

### Homebrew 安装 Bootstrap

如果你希望在本机长期保留一个按需下载 `web / server / app / cli` 的启动器，可以安装 bootstrap：

```bash
brew install vibe-forge-ai/tap/vibe-forge-bootstrap
```

更新：

```bash
brew update
brew upgrade vibe-forge-bootstrap
```

当前 Homebrew formula 安装 `@vibe-forge/bootstrap`，会暴露 `vibe-forge-bootstrap` 和 `vfb` 两个命令。

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

如果你希望把集成 Web UI 作为项目依赖安装：

```bash
pnpm add -D @vibe-forge/web
```

如果你只需要 headless server：

```bash
pnpm add -D @vibe-forge/server
```

更细粒度的高级场景，仍然可以单独安装 CLI、client、adapter 和插件包：

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
npx @vibe-forge/bootstrap web --help
npx @vibe-forge/bootstrap run --help
npx @vibe-forge/web --help
npx @vibe-forge/server --help
```

## 配置与数据目录

默认情况下，Vibe Forge 会把解析后的 workspace 根目录作为项目配置根目录。

- 如果显式设置了 `__VF_PROJECT_WORKSPACE_FOLDER__`，直接使用该目录。
- 如果没有设置，会从当前启动目录向上探测 `.ai`、`.ai.config.*`、`pnpm-workspace.yaml` 或 Git 根目录。

在这个配置根目录准备 `.ai.config.json` / `.ai.config.yaml` / `.ai.config.yml`；可选开发态配置使用 `.ai.dev.config.*`。同名配置也可放在 `./infra/` 下。

如果你希望把配置文件放到别的目录，可以额外在启动环境里设置 `__VF_PROJECT_CONFIG_DIR__`，它支持相对启动目录（launch cwd）的路径与绝对路径。

数据资产目录、`.ai/` 子目录和 `__VF_PROJECT_AI_BASE_DIR__` / `__VF_PROJECT_AI_ENTITIES_DIR__` 覆盖方式见 [数据资产目录配置](../asset-directories.md)。
