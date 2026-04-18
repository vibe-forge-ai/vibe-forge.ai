# Web UI 与 Terminal 视图

返回入口：[index.md](../index.md)

## Web UI 入口

- 启动 `vfui-server` 和 `vfui-client` 后，先访问 `/ui`。
- Web UI 默认要求登录；账号配置见 [启动服务](./runtime.md) 中的 `webAuth` 示例。
- 会话详情页路径是 `/ui/session/<sessionId>`。
- 配置页路径是 `/ui/config`；通过 `tab` 和 `source` query 控制当前 section 与 project/user 来源，例如 `/ui/config?tab=general&source=user`。
- 如果配置页进入了二级详情页，当前详情路径也会写入 `detail` query；复制完整 URL 后，可以直接回到对应的配置子页面。
- `view` query 目前支持 `history`、`timeline`、`terminal`、`settings`。
- 终端视图入口是 `/ui/session/<sessionId>?view=terminal`。
- 聊天页 sender 下方会固定显示一个 status bar：左侧承载当前 session 的 workspace / git 操作；新建会话时这里会继续展示，并允许先决定是否创建 worktree 以及要切到哪个分支。
- 分支面板支持 `树状 / 平铺` 两种展示模式；两种视图共用同一套搜索和切换逻辑。
- 如果新建会话启用了 worktree，但没有显式指定分支，server 会默认从源 worktree 当前分支派生一个新的 session worktree 分支；只有源目录本身是 detached HEAD 时，才会退回 detached 模式。
- session managed worktree 会落在 `.ai/worktrees/sessions/<sessionId>/<repo-name>`；最后一级目录始终跟随当前 git 根目录名，方便和真实仓库目录保持一致。
- 如果当前 session 分支还没有对应的远端分支，`同步` 会优先尝试同名远端分支；如果远端还没有这条分支，则会回退到 worktree 记录的基线分支继续同步。
- 如果你想给项目设默认值，可以在解析后的 workspace 根目录配置文件（默认是 `.ai.config.json` / `.ai.config.yaml`，也支持 `./infra/` 或显式 `__VF_PROJECT_CONFIG_DIR__`）里设置 `conversation.createSessionWorktree`；Web UI 新建会话时会按这个项目配置初始化。

## 配置页交互

- 简单字段仍然在 section 页面内直接编辑。
- 复杂集合字段会拆成“一级摘要页 + 二级详情页”的模式：数组型字段在一级页负责新增、删除和排序；对象型字段会展示固定条目和快捷开关，进入二级页后再做细粒度配置。
- 二级详情页会在 section 标题右侧展示字段路径面包屑，并提供返回入口；返回时会尽量恢复上一级列表的滚动位置。
- `adapters.<adapter>.accounts` 现在额外提供一个账号管理子页：可以直接触发 adapter 的接入动作、查看账号来源和额度摘要，并进入账号三级详情页编辑 `title / description / authFile`。
- 当前 `general.recommendedModels`、`general.notifications.events`、`modelServices`、`channels`、`adapters`、`plugins.plugins`、`plugins.marketplaces` 和 `mcp.mcpServers` 已经切到这套模式。

## Terminal 视图是什么

- `terminal` 视图会在当前 workspace 上下文里打开一个交互式 shell。
- 同一个会话页可以通过 terminal 面板右上角 `+` 创建多个 terminal pane；多个 pane 会在同一个 dock 内自动拼接展示，每个 pane 对应一条独立 shell runtime。
- `+` 和右侧下拉入口作为一个创建按钮组展示，下拉入口可以选择新 terminal 使用的 shell 类型。
- terminal 输入焦点内支持清屏快捷键：macOS / iPadOS 使用 `Cmd+K`，Windows / Linux 使用 `Ctrl+K`，触发后只清空前端输出，不向 shell 发送控制字符。
- terminal 输入焦点内会把 macOS / iPadOS 的 `Option` 作为 terminal Meta 键处理，支持 `Option+b/f/d/delete` 等 shell 快捷键；普通 shell 输入行里按词移动可使用 `Option+←/→`，前端会按当前渲染行计算词边界并发送普通左右箭头，避免在 vi keymap 下触发 `ESC f` 的 find-char 行为；进入 vim / tmux 等 alternate screen 后会保留标准 `Alt+←/→` 箭头序列，Windows / Linux 支持 `Alt+←/→` 和 `Ctrl+←/→`。
- terminal 面板操作栏支持全屏 / 退出全屏；全屏时 terminal dock 覆盖当前会话内容区域，并隐藏上方聊天内容。
- 多个 terminal pane 存在时，操作栏支持隐藏 / 显示右侧管理列表；列表隐藏时，切换按钮右下角会显示当前 pane 数量。
- 右侧管理列表支持双击标题进入编辑、hover 后关闭以及通过插入指示线拖拽调整顺序；列表标题固定保存在 pane 配置中，shell 类型在标题 hover tooltip 中展示。
- 前端使用 `xterm.js` 渲染；后端走独立 terminal websocket channel，而不是复用 chat `WSEvent`。
- 终端 pane 的标题、shell 类型和排序保存在当前浏览器的 localStorage；终端 scrollback 和 socket 生命周期保存在 server runtime 内存里，不写入 chat `messages` 持久化表。
- 重新打开同一会话页时，页面会按已保存的 pane 列表尝试重连已有 terminal runtime；如果会话已删除或 sessionId 不存在，会返回 fatal error 并关闭 socket。

## 使用前提

- `__VF_PROJECT_WORKSPACE_FOLDER__` 要指向你真正想操作的项目目录；如果没显式设置，server 启动时会从当前目录向上探测 workspace 根目录。
- server 进程需要能在该 workspace 下启动 shell；如果运行环境缺少 PTY 能力，交互体验会退化。
- terminal 主题跟随当前 Web UI 的浅色 / 深色 token，不需要额外配置第二套主题参数。

## 排查顺序

- 页面打不开 terminal 时，先确认 `sessionId` 对应的会话在 `/api/sessions` 里真实存在。
- 页面能打开但不能交互时，先看 browser focus 和 terminal websocket，再看 server 端 shell / PTY 是否正常启动。
- 只看到背景或颜色异常时，先检查 `.chat-terminal-view__surface`、`.xterm-viewport` 和 terminal renderer 的实际背景，而不是只看外层容器。
