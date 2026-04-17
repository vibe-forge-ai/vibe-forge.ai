# Web UI 与 Terminal 视图

返回入口：[index.md](../index.md)

## Web UI 入口

- 启动 `vfui-server` 和 `vfui-client` 后，先访问 `/ui`。
- Web UI 默认要求登录；账号配置见 [启动服务](./runtime.md) 中的 `webAuth` 示例。
- 会话详情页路径是 `/ui/session/<sessionId>`。
- `view` query 目前支持 `history`、`timeline`、`terminal`、`settings`。
- 终端视图入口是 `/ui/session/<sessionId>?view=terminal`。
- 聊天页 sender 下方会固定显示一个 status bar：左侧承载当前 session 的 workspace / git 操作；新建会话时这里会继续展示，并允许先决定是否创建 worktree 以及要切到哪个分支。
- 分支面板支持 `树状 / 平铺` 两种展示模式；两种视图共用同一套搜索和切换逻辑。
- 如果新建会话启用了 worktree，但没有显式指定分支，server 会默认从源 worktree 当前分支派生一个新的 session worktree 分支；只有源目录本身是 detached HEAD 时，才会退回 detached 模式。
- session managed worktree 会落在 `.ai/worktrees/sessions/<sessionId>/<repo-name>`；最后一级目录始终跟随当前 git 根目录名，方便和真实仓库目录保持一致。
- 如果当前 session 分支还没有对应的远端分支，`同步` 会优先尝试同名远端分支；如果远端还没有这条分支，则会回退到 worktree 记录的基线分支继续同步。
- 如果你想给项目设默认值，可以在 `.ai.config.json` / `.ai.config.yaml` 的 `conversation.createSessionWorktree` 里配置；Web UI 新建会话时会按这个项目配置初始化。

## Terminal 视图是什么

- `terminal` 视图会在当前 workspace 上下文里打开一个交互式 shell。
- 前端使用 `xterm.js` 渲染；后端走独立 terminal websocket channel，而不是复用 chat `WSEvent`。
- 终端 scrollback 和 socket 生命周期保存在 server runtime 内存里，不写入 chat `messages` 持久化表。
- 重新打开同一会话页时，页面会尝试重连已有 terminal runtime；如果会话已删除或 sessionId 不存在，会返回 fatal error 并关闭 socket。

## 使用前提

- `__VF_PROJECT_WORKSPACE_FOLDER__` 要指向你真正想操作的项目目录。
- server 进程需要能在该 workspace 下启动 shell；如果运行环境缺少 PTY 能力，交互体验会退化。
- terminal 主题跟随当前 Web UI 的浅色 / 深色 token，不需要额外配置第二套主题参数。

## 排查顺序

- 页面打不开 terminal 时，先确认 `sessionId` 对应的会话在 `/api/sessions` 里真实存在。
- 页面能打开但不能交互时，先看 browser focus 和 terminal websocket，再看 server 端 shell / PTY 是否正常启动。
- 只看到背景或颜色异常时，先检查 `.chat-terminal-view__surface`、`.xterm-viewport` 和 terminal renderer 的实际背景，而不是只看外层容器。
