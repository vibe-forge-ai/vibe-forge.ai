# Desktop Package

`@vibe-forge/desktop` 是 Electron 桌面壳，负责窗口生命周期、内置 server 生命周期、本地 workspace 选择与安装包产物；业务逻辑仍复用 `@vibe-forge/server` 与 `@vibe-forge/client`。

## 先看哪里

- `src/main.cjs`
  - BrowserWindow 创建
  - workspace 持久化与切换
  - 内置 server 启停
  - 桌面端环境变量注入
- `src/server-child.cjs`
  - dev / packaged 场景下如何桥接到 `@vibe-forge/server`
- `scripts/package.cjs`
  - `pnpm deploy --legacy --prod` staging
  - multi-arch 预打包
  - auto-update 资源注入
  - 原生依赖裁剪
- `scripts/make.cjs`
  - 从 prepackaged app 生成安装 / 分发产物
  - 签名开关
  - macOS 双架构 `latest-mac.yml` 合并
- `scripts/smoke-packaged-server.cjs`
  - 包内 server smoke test 契约
- `electron-builder.yml`
  - 目标平台、artifact 命名、GitHub publish 配置
- `build/app-update.yml`
  - 桌面正式更新通道配置

## 当前边界

- Electron main 进程不重复实现 server 业务逻辑；桌面端 server 仍通过 `src/server-child.cjs` 复用 `@vibe-forge/server`。
- 桌面端始终依赖静态 client dist；`pnpm desktop:dev`、`pnpm desktop:package`、`pnpm desktop:make` 都默认先构建 client。
- 内置本机服务默认关闭 `webAuth`，并把数据库、日志与桌面状态写入 Electron `userData`。
- 当前打包保持 `asar: false`，因为 staging 仍依赖 `pnpm deploy` 生成的依赖布局与原生模块路径。
- macOS 正式产物按 `arm64` / `x64` 分别构建并分别发布，不做 universal 合包。
- Windows 当前 builder 目标仍是 `nsis-web`；正式安装包体验还未收口时，不要提前在外层文档里承诺 MSI / 完整离线安装器。

## 维护约定

- 改内置 server 启动参数、workspace 解析或资源路径时，至少同时检查：
  - `src/main.cjs`
  - `src/server-child.cjs`
  - `scripts/smoke-packaged-server.cjs`
- 改打包资源布局时，`scripts/package.cjs`、`scripts/make.cjs`、`electron-builder.yml` 与 smoke test 要一起看；不要只改其中一个入口。
- 改 auto-update 时，要一起验证：
  - `build/app-update.yml`
  - `electron-builder.yml` 的 `publish`
  - `VF_DESKTOP_ENABLE_AUTO_UPDATE`
  - `DESKTOP_AUTO_UPDATE`
    目标是继续保证 PR / master artifact 不会误进稳定更新通道。
- 改签名逻辑时，不要破坏“默认关闭签名”的本地与 CI 行为；当前只有显式设置 `VF_DESKTOP_SIGN=true` 或 CI 打开 `DESKTOP_SIGN=true` 时才进入签名流程。
- 改版本号传递或 artifact 命名时，保持 `desktop-v*` tag、`artifactName` 与 `latest*.yml` 中的 URL 一致，否则自动更新会直接失效。

## 已验证经验

- 打包链路最好分两段理解：
  - `pnpm desktop:package` 负责产出“当前平台可运行的 app”
  - `pnpm desktop:make` 负责基于 prepackaged app 生成安装 / 分发产物
    这两段混在一起排查时最容易看错问题发生层级。
- macOS 双架构打包依赖 `scripts/make.cjs` 在 release 目录里合并 `latest-mac.yml`；改动多架构逻辑后，要确认最终只留下一个对外使用的 `latest-mac.yml`。
- 包内 server 是否真的可启动，不要只看 Electron 能不能打开窗口；优先跑 `pnpm -C apps/desktop smoke:package`，让 packaged server 真正响应 `/api/auth/status`。
- `node-pty`、`node-notifier` 这类平台相关依赖会直接影响包体大小和运行稳定性；改 native 依赖或目标架构时，要连同 `scripts/package.cjs` 里的裁剪逻辑一起验证。
- `ELECTRON_RUN_AS_NODE`、`__VF_PROJECT_AI_CLIENT_DIST_PATH__`、`__VF_PROJECT_WORKSPACE_FOLDER__` 这些环境变量缺任何一个，都容易让 packaged server 启不来或连不上正确的前端资源。

## 常见坑位

- 只改 `electron-builder.yml`，不改 `scripts/make.cjs` / `scripts/package.cjs`：通常会出现本地能打包、CI 产物却不对，或者反过来。
- 只验证 dev 模式，不验证 packaged 模式：很多桌面问题只会在 `out/` 或安装产物里出现。
- 让非 `desktop-v*` release 覆盖 GitHub Latest：会把桌面自动更新通道指到错误 release。
- 提前开启自动更新而没有签名：即使更新元数据可用，真实分发体验通常也会被系统安全策略拦住。
