# VS Code 扩展

返回入口：[index.md](../index.md)

VS Code 扩展位于 `apps/vscode-extension`，当前是一个薄壳：

- 通过 Activity Bar 的 Vibe Forge 入口在侧边栏打开完整 client。
- 通过 `Vibe Forge: Open Workspace` 切换当前侧边栏控制的 workspace。
- 每个 workspace folder 会启动并复用一个本机 Vibe Forge UI server。
- 多个 workspace folder 可以同时保留各自的 server；侧边栏显示当前选中的 workspace。
- Webview 内打开该 server 托管的 `/ui/`，界面仍复用 `@vibe-forge/client`。
- Server 通过用户环境里的 `vfui-server` / `vibe-forge-ui-server` 启动，业务逻辑不在扩展中重复实现。

扩展不内置、不自动安装 Vibe Forge runtime 包。它只嗅探用户环境，并在找不到时提示安装或配置。

## 本地试用

在仓库根目录执行：

```bash
pnpm vscode:package
```

该命令只编译 VS Code extension。随后在 VS Code 的 Extension Development Host 中执行：

```text
Vibe Forge: Open Workspace
```

要控制某个项目，需要先在该项目里安装 UI runtime：

```bash
pnpm add -D @vibe-forge/server @vibe-forge/client
```

## 运行模型

扩展默认按 workspace folder 隔离 server：

- `vfui-server` 查找顺序：`vibeForge.serverCommand`、`VF_VSCODE_SERVER_COMMAND`、当前 workspace 的 `node_modules/.bin`、系统 `PATH`。
- client dist 查找顺序：`vibeForge.clientDistPath`、`VF_VSCODE_CLIENT_DIST_PATH`、当前 workspace 的 `node_modules/@vibe-forge/client/dist`、`apps/client/dist`、`client/dist`。
- server 监听 `127.0.0.1` 的随机端口。
- `webAuth` 默认关闭。
- 数据库、日志和运行数据写入 VS Code extension 的 global storage，并按 workspace path hash 分目录。
- 侧边栏 webview 使用 iframe 打开本机 server 的 `/ui/`。

多根 workspace 下，侧边栏默认优先使用当前编辑器所在的 workspace folder；无法判断时使用第一个 workspace folder。执行 `Vibe Forge: Open Workspace` 可以手动切换。

再次执行 `Vibe Forge: Open Workspace` 时，扩展会切换侧边栏当前 workspace；已启动过的其他 workspace server 会继续保留，直到执行停止命令或扩展停用。

## 配置项

- `vibeForge.clientDistPath`：可选的 client `dist` 目录绝对路径。
- `vibeForge.serverCommand`：可选的 `vfui-server` 可执行文件、命令名或 wrapper command。

如果项目未把 `@vibe-forge/server` / `@vibe-forge/client` 安装到本地依赖，也可以把 `vibeForge.serverCommand` 指向系统安装的 `vfui-server`，并用 `vibeForge.clientDistPath` 指向已构建的 client `dist`。

## 当前边界

- 当前扩展只提供 webview 壳和 per-project server 生命周期管理。
- 完整 client 当前直接嵌入 VS Code 侧边栏；宽度由用户拖拽侧边栏控制。
- 打包分发与 VSIX 发布流程尚未接入 CI。
- 扩展不会为用户自动安装 `@vibe-forge/server` / `@vibe-forge/client`。
