# 数据资产目录配置

返回入口：[index.md](./index.md)

本文说明如何通过项目根 `.env` 调整 Vibe Forge 的项目数据资产目录，以及这些目录会影响哪些运行时消费链路。

## 默认目录

默认情况下，项目数据资产根目录是 `./.ai/`，常见结构包括：

- `./.ai/rules`
- `./.ai/skills`
- `./.ai/specs`
- `./.ai/entities`
- `./.ai/mcp`
- `./.ai/logs`
- `./.ai/caches`
- `./.ai/plugins`
- `./.ai/.mock`
- `./.ai/.local`

## 环境变量

可以在项目根 `.env` 中覆盖：

```env
__VF_PROJECT_AI_BASE_DIR__=.vf
__VF_PROJECT_AI_ENTITIES_DIR__=agents
```

含义：

- `__VF_PROJECT_AI_BASE_DIR__`：覆盖整个项目数据资产根目录
- `__VF_PROJECT_AI_ENTITIES_DIR__`：只覆盖实体子目录，基于 AI 基目录继续解析

两者都支持：

- 相对项目根的目录
- 相对项目根的嵌套目录
- 绝对路径

例如：

```env
__VF_PROJECT_AI_BASE_DIR__=.config/vibe/ai-data
__VF_PROJECT_AI_ENTITIES_DIR__=knowledge/entities
```

此时：

- AI 基目录会解析为 `./.config/vibe/ai-data`
- 实体目录会解析为 `./.config/vibe/ai-data/knowledge/entities`

## 影响范围

这些环境变量会影响项目数据资产的主要消费链路：

- workspace assets：`rules`、`skills`、`specs`、`entities`、`mcp`
- 运行时目录：`logs`、`caches`、`plugins`
- 本地私有目录：`.local`
- mock HOME 与 adapter 派生目录：Codex、Claude Code、OpenCode
- CLI 维护命令：`vf clear`、`vf report`
- 启动入口：CLI、server、client、hook loader
- benchmark 运行时目录

其中：

- `__VF_PROJECT_AI_BASE_DIR__` 会影响整棵项目数据资产树
- `__VF_PROJECT_AI_ENTITIES_DIR__` 只影响 `entities` 的扫描与加载位置

`./.ai/.local` 用于当前 workspace 的私有本地数据，不应提交到 Git。

当前主要用途包括：

- adapter 多账号凭据快照
- adapter 账号的来源、auth digest 与额度快照元数据
- 只应保存在本机的认证状态或临时元数据

例如 `codex` 当前会在：

- `.ai/.local/adapters/codex/accounts/<accountKey>/auth.json`
- `.ai/.local/adapters/codex/accounts/<accountKey>/meta.json`

保存账号快照与账号元数据。`meta.json` 里可能包含：

- 账号来源说明
- auth 摘要
- 最近一次 quota / rate-limit 快照
- quota 快照更新时间

如果当前目录是 Git worktree，adapter 账号目录会共享到主 worktree：

- 写入和导入优先落到主 worktree 的 `.ai/.local`
- 读取时先读主 worktree 的共享目录
- 只有共享目录里没有对应账号时，才回退当前 worktree 的旧 `.ai/.local`

## 不受影响的内容

当前不会跟随这些环境变量一起变化的内容：

- `.ai.config.json` / `.ai.config.yaml` / `.ai.config.yml`
- `.ai.dev.config.*`
- 这些配置文件默认位于解析后的 workspace 根目录或 `./infra/` 的规则

也就是说，`__VF_PROJECT_AI_BASE_DIR__` / `__VF_PROJECT_AI_ENTITIES_DIR__` 只配置“数据资产目录”，不配置“配置文件文件名与位置”。

如果你需要改配置文件目录，应单独使用 `__VF_PROJECT_CONFIG_DIR__`；否则配置读写会默认跟随解析后的 workspace 根目录。

## 使用建议

- 如果只是想把 `.ai` 改成别的名字，优先只配 `__VF_PROJECT_AI_BASE_DIR__`
- 如果只是想把 `entities` 改名，优先只配 `__VF_PROJECT_AI_ENTITIES_DIR__`
- 如果同时配置两者，实体目录会基于新的 AI 基目录继续拼接
- 修改 `.env` 后需要重启相关进程；只刷新前端页面不会让已有子进程重新加载目录配置
