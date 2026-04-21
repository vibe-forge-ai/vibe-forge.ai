# 桌面打包与发布

返回入口：[desktop.md](./desktop.md)

## 本地打包

在仓库根目录执行：

```bash
pnpm desktop:package
```

该命令只生成当前平台可运行的应用包，产物位于 `apps/desktop/out/`。例如 macOS 下会生成 `.app` 目录，可直接打开验证。打包流程会先用 `pnpm deploy --legacy --prod` 生成生产 staging，再把 staging 放入 Electron 应用包。

生成安装 / 分发产物：

```bash
pnpm desktop:make
```

`desktop:make` 会先执行 `desktop:package`，再用 `electron-builder` 基于 prepackaged app 生成当前平台的发行文件，产物位于 `apps/desktop/release/`：

- macOS：Intel（`x64`）与 Apple Silicon（`arm64`）分别提供 `.dmg`、`.zip`
- Windows：安装包方案仍在收口，正式发布前先以 issue [#161](https://github.com/vibe-forge-ai/vibe-forge.ai/issues/161) 跟踪
- Linux：`.AppImage`、`.deb`、`.tar.gz`

如果已经执行过 `desktop:package`，可以只从现有包生成安装产物：

```bash
pnpm -C apps/desktop make:from-package
```

生成安装产物时默认不签名，脚本会关闭证书自动发现并忽略 `CSC_LINK` / `CSC_KEY_PASSWORD` 等签名变量。设置 `VF_DESKTOP_SIGN=true` 后，`electron-builder` 会使用本机证书或 `CSC_LINK` / `CSC_KEY_PASSWORD` 等环境变量进行签名。macOS 公证需要额外提供 `APPLE_ID`、`APPLE_ID_PASSWORD`、`APPLE_TEAM_ID`。

证书准备见：[桌面签名与发布](./desktop-signing.md)。

## CI 打包

GitHub Actions 工作流位于 `.github/workflows/desktop-package.yml`，会在影响桌面包的 PR / master push 上运行，也支持手动触发；推送 `desktop-v*` tag 时会创建或更新 GitHub Release。普通 `v*` tag 不会发布 Electron 安装包。

CI 会并行构建 macOS、Windows、Linux：

- 安装依赖。
- macOS 任务会在同一个 runner 上连续生成 `arm64` 与 `x64` 两套预打包应用。
- 执行 `pnpm -C apps/desktop smoke:package`，用宿主架构对应的 Electron 可执行文件启动包内 server，并请求 `/api/auth/status` 做 smoke test。
- 执行 `pnpm -C apps/desktop make:from-package` 生成当前平台安装 / 分发产物；macOS 会合并两套架构的 `latest-mac.yml` 自动更新元数据。
- 上传 `apps/desktop/release/` 下的产物为 artifact。
- 当触发来源是 `desktop-v*` tag，或手动触发时勾选 `create_release` 并提供 `desktop-v*` 格式的 `release_tag`，会把三个平台的 artifact 上传到 GitHub Release。

CI 签名默认关闭。需要在仓库配置以下变量 / secrets 后再开启：

- Repository variable：`DESKTOP_SIGN=true`
- Repository variable：`DESKTOP_AUTO_UPDATE=true`，仅在签名完成并准备让正式 release 进入自动更新通道时开启
- 通用签名：`DESKTOP_CSC_LINK`、`DESKTOP_CSC_KEY_PASSWORD`
- macOS 公证：`APPLE_ID`、`APPLE_ID_PASSWORD`、`APPLE_TEAM_ID`

Release 中的 `latest.yml`、`latest-mac.yml`、`latest-linux.yml` 等更新元数据由 `electron-builder` 生成，用于后续自动更新。发行文件名固定为 `vibe-forge-${version}-${os}-${arch}.${ext}`，避免更新元数据中的 URL 与实际 artifact 名称不一致。`desktop-v` 后面的版本号会传入打包流程，例如 `desktop-v0.2.0` 生成 `0.2.0` 版本安装包。

## 正式发布前需要准备

- 桌面应用图标：当前使用 `apps/desktop/build/icon.svg` 生成的临时图标，并已提交 macOS `.icns`、Windows `.ico`、Linux `.png`。正式发布前应替换为最终品牌源图。
- macOS 签名与公证：需要 Apple Developer Team、Developer ID Application 证书、app-specific password 或对应的 CI 凭据。
- Windows 签名：需要代码签名证书，并配置 `DESKTOP_CSC_LINK`、`DESKTOP_CSC_KEY_PASSWORD`；如果选择 Azure Artifact Signing，需要补 Windows 云签名脚本。
- Release 策略：桌面正式 release 使用 `desktop-v*` tag，并由 CI 标记为 GitHub Latest。
- 自动更新策略：只让 `desktop-v*` release 进入稳定更新通道；签名配置完成后开启 `DESKTOP_AUTO_UPDATE=true`。

## 自动更新

桌面应用内置 `electron-updater`。应用启动后，如果检测到包内存在 `app-update.yml` 等更新配置，会自动检查更新并在下载完成后提示重启安装。

当前 `app-update.yml` 指向 GitHub provider：`vibe-forge-ai/vibe-forge.ai`。如果仓库迁移或发布到 fork，需要同步更新 `apps/desktop/build/app-update.yml` 与 `apps/desktop/electron-builder.yml` 的 `publish` 配置。

默认本地打包和 PR / master artifact 不会内置 `app-update.yml`。如需本地模拟正式更新包：

```bash
VF_DESKTOP_ENABLE_AUTO_UPDATE=true pnpm desktop:package
pnpm -C apps/desktop make:from-package
```

可通过环境变量关闭更新检查：

```bash
VF_DESKTOP_AUTO_UPDATE=false
```

可通过环境变量只检查不自动下载：

```bash
VF_DESKTOP_AUTO_UPDATE_DOWNLOAD=false
```
