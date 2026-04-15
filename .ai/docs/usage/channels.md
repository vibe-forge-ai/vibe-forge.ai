# Channel 会话绑定

返回入口：[index.md](../index.md)

## 基本语义

- channel 入口不是直接绑定到某个裸工作目录，而是绑定到 `session`。
- `session` 再绑定自己的 workspace；当 workspace 模式启用时，这个 workspace 通常是独立的 managed worktree。
- 因此，在 channel 里切换 session，本质上也会切换到另一个 session 对应的 workspace。

## 当前行为

- 新建 session 时，server 会优先为它创建独立 worktree；如果当前目录不是 Git 仓库，则回退到共享 workspace。
- 删除 session 时，server 会清理它绑定的 managed worktree；如果 worktree 里还有未提交改动，默认会拒绝删除，必须显式强制。
- `/session` 会显示当前绑定 session 的 workspace 路径、模式和清理策略。
- `/session bind <id>` 在切换会话后，会回显目标 session 当前绑定的 workspace。

## 入口对齐

- Web UI、terminal、Git 面板、文件引用器都按当前 session 的 workspace 解析运行目录。
- channel 命令层不直接管理 `git worktree`；它只负责切换 session，workspace 切换由底层统一完成。
