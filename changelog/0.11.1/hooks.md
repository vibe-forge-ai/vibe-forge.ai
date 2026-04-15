# @vibe-forge/hooks 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/hooks@0.11.1`

## 主要变更

- 内置权限插件在 server 侧 `permission-check` 返回 `inherit` 时，不再直接放弃判断；它会继续读取本地 session/project permission mirror，让 `allow_session`、`allow_project` 这类恢复后的授权在 Claude Code、OpenCode 和 MCP 任务场景里真正生效。
- `StartTasks` hook 的输入类型补齐了 `taskId` 和 `permissionMode`，方便 hook/plugin 在多任务场景里按任务粒度识别权限继承和后续恢复链路。

## 兼容性说明

- 不改 hooks runtime API。
- 现有 hook 插件无需修改；若消费 `StartTasks` 类型，升级后只会看到更完整的字段。
