# Adapter 配置与多账号

返回入口：[index.md](../index.md)

本文说明 Web 配置页里的 adapter 配置结构，以及 adapter 通用多账号能力的使用方式。

## 配置入口

- Web 配置页路径：`/ui/config?tab=adapters&source=project`
- adapter 详情页路径：`/ui/config?tab=adapters&source=project&detail=<adapter>`
- 账号列表页路径：`/ui/config?tab=adapters&source=project&detail=<adapter>/accounts`
- 账号详情页路径：`/ui/config?tab=adapters&source=project&detail=<adapter>/accounts/<accountKey>`

`source` 也可以切到 `user`，用于编辑用户级 adapter 覆盖。

## Adapter 配置分组

adapter 详情页默认按前端语义拆成几组，而不是把所有字段平铺在一层：

- `基础配置`
- `模型配置`
- `高阶配置`
- `账号`

其中：

- `defaultAccount` 会展示在 `基础配置` 中，并通过下拉框选择当前已发现或已配置的账号 key。
- `账号` 是独立入口，不和普通字段混在一起。
- 复杂字段会继续留在 `高阶配置` 或其子分组中，而不是堆在基础配置里。

## 通用多账号能力

adapter 可以实现统一的账号目录、账号详情和账号管理动作。

当前约定的 workspace 私有目录是：

```text
.ai/.local/adapters/<adapter>/accounts/<accountKey>/
```

常见文件包括：

- `auth.json`
  - adapter 对应账号的凭据快照
- `meta.json`
  - 账号来源、账号摘要、额度快照等本地元数据

这些文件属于当前 workspace 的本地私有数据，不应该提交到 Git。

在 Git worktree 场景下，账号快照会共享到主 worktree：

- 新增账号、登录导入和 artifact 落盘优先写入主 worktree 下的 `.ai/.local/adapters/<adapter>/accounts/`
- 读取时也优先读主 worktree 下的共享目录
- 如果共享目录里没有对应账号，才回退读取当前 worktree 下的旧目录

这样可以避免每新建一个 worktree 都重复登录，同时兼容历史上已经写在各个 worktree 里的本地账号快照。

## Web 配置页里的账号管理

在 `Adapters -> <adapter> -> 账号` 中：

- 根页会展示账号列表、默认账号摘要和搜索框
- 可以直接触发 adapter 提供的 `接入账号` 动作
- 可以在列表里把某个账号设为默认账号
- 可以删除当前 workspace 保存的账号快照
- 点进单个账号后，可以查看来源、额度摘要和账号配置字段

账号详情页里的可编辑字段来自 adapter 自己的 `accounts.<key>` schema。\
当前 `codex` 已经支持：

- `title`
- `description`
- `authFile`

其中：

- `description` 会用多行输入框编辑
- `authFile` 留空时，会优先读取主 worktree 下的 `.ai/.local/adapters/codex/accounts/<accountKey>/auth.json`

## CLI 管理账号

当前通用入口是：

```bash
npx vf accounts add <adapter> [accountName]
npx vf accounts show <adapter> <accountName>
npx vf accounts remove <adapter> <accountName>
```

说明：

- `add`
  - 调用 adapter 暴露的接入能力
  - 如果 adapter 返回 `auth.json` / `meta.json` 这类 artifact，上层会自动落到 workspace 私有目录
- `show`
  - 读取 adapter 账号详情
  - 当前 CLI 会强制刷新一次账号详情和额度摘要
- `remove`
  - 删除当前 workspace 下保存的账号快照

## Codex 示例

`codex` 已经接入这套通用多账号能力。配置示例：

```yaml
adapters:
  codex:
    defaultAccount: work
    accounts:
      work:
        title: Work
        description: 公司账号
      personal:
        title: Personal
        authFile: /absolute/path/to/personal-auth.json
```

行为说明：

- 如果本机存在 `~/.codex/auth.json`，Codex adapter 会把当前登录态导入到 workspace 私有目录
- 每个 Codex session 会切到隔离 HOME 运行，并在该 HOME 下挂载所选账号的 `auth.json`
- Web 配置页默认展示缓存后的额度快照；当前 Codex quota 快照默认缓存 5 分钟
- CLI `vf accounts show codex <account>` 会主动刷新一次最新额度信息

## Copilot 示例

`copilot` 使用官方 GitHub Copilot CLI。Vibe Forge 会把运行时配置写入当前 workspace 的 `.ai/.mock/copilot/settings.json`，并把 CLI auth/keychain 交给官方 CLI 自己处理。

```yaml
adapters:
  copilot:
    cli:
      source: managed
      version: 1.0.36
    remote: false
    stream: true
    agent: reviewer
    agentDirs:
      - /absolute/path/to/copilot-agents
    pluginDirs:
      - /absolute/path/to/copilot-plugin
    mode: autopilot
    allowTools:
      - shell(git:*)
    denyTools:
      - shell(git push)
    allowUrls:
      - https://docs.github.com/copilot/*
    additionalDirs:
      - /absolute/path/to/shared-context
    configContent:
      askUser: false
```

行为说明：

- selected skills 会 stage 到 session 目录，并通过 `COPILOT_SKILLS_DIRS` 注入 Copilot CLI
- 任务 system prompt 会写成 session 级 custom instructions，并通过 `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` 注入
- selected MCP servers 会翻译成 `--additional-mcp-config`
- `modelServices.extra.copilot` 可以配置 BYOK/provider 细节，adapter 会映射为 `COPILOT_PROVIDER_*`
- hook plugins 会接入 Copilot native `PreToolUse` / `PostToolUse` / `Stop`，对应通用 bridge 事件会自动去重
- project/user 两层 Copilot adapter 配置会对 `cli` 与 `configContent` 做深合并，避免 user config 覆盖整块 native settings
- `mode` 会直接映射 `--mode`，并优先于 `autopilot` / plan permission；需要 autopilot 时推荐配置 `mode: autopilot` 或 `autopilot: true` 二选一

当前不实现 Copilot 多账号 API；需要登录、切换或排查账号时，使用官方 CLI 的 `/login`、`/logout`、`/user` 流程。

## 什么时候更新文档

如果你修改了下面这些行为，记得同步更新本文以及 CLI / Web 使用文档：

- adapter 配置页的分组和入口位置
- `defaultAccount` / `accounts` 的配置语义
- 账号目录结构
- CLI 子命令行为
- quota / rate-limit 的刷新和缓存策略
