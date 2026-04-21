# MDP 集成

返回入口：[index.md](../index.md)

这页说明 Vibe Forge 当前的第一版 Model Drive Protocol 集成。

## 默认行为

启动 task runtime 时，Vibe Forge 会默认额外注入一个 `MDP` MCP server。

这不是另一套业务工具集合，而是一个固定 bridge：

- 它内部启动 `@vibe-forge/mdp`
- `@vibe-forge/mdp` 再桥接到一个或多个 MDP server hosts
- host 侧看到的仍然是标准 `listClients`、`listPaths`、`callPath`、`callPaths`

如果你不想默认注入这层 bridge，可以在配置里关闭：

```yaml
mdp:
  noDefaultBridge: true
```

默认情况下，Vibe Forge 还会把这些低风险 discovery 权限自动加入 `permissions.allow`：

- `mcp-mdp-listclients`
- `mcp-mdp-listpaths`
- `mcp-mdp-callpath-get-skill`

这意味着下面这些调用默认不会再打断当前任务：

- `MDP.listClients`
- `MDP.listPaths`
- `MDP.callPath(GET /skill.md)`
- `MDP.callPath(GET .../skill.md)`

这一步只放开渐进式发现和 skill 文档读取，不会默认放开普通 `callPath` / `callPaths` 的执行权限。

## 基本配置

最小示例：

```yaml
mdp:
  connections:
    default:
      hosts:
        - ws://127.0.0.1:47372
```

同一个逻辑 connection 支持多个候选 host：

```yaml
mdp:
  connections:
    default:
      hosts:
        - ws://127.0.0.1:47372
        - ws://127.0.0.1:57372
```

当前实现会按顺序尝试连接这些 hosts。

## 推荐发现顺序

使用 MDP 时，优先走渐进式发现，不要默认一次性把所有 client 的 path catalog 都拉进上下文。

推荐顺序：

1. 如果当前入口已经注入了首选 MDP client id，先从这个 client 开始。
2. 只有在需要确认 live clients 或需要跨 client 选择 owner 时，再调用 `MDP.listClients`。
3. 选定单个 client 后，再调用 `MDP.listPaths`，并尽量传 `clientId`；如果已经知道大致 path family，再加 `search` 缩小范围。
4. 优先读取目标 client 的 `/skill.md` 或 scoped `.../skill.md`，先理解能力分层，再进入具体 path。
5. 找到精确 path 后，直接 `callPath` / `callPaths`，不要反复全量枚举 catalog。

当前 bridge 也会主动把 discovery 结果做轻量排序：

- `listClients` 会优先返回 Browser / Server / Channels / CLI，再把 Workspace projection 放后面。
- `listPaths` 会优先返回 `/skill.md` 和 scoped `.../skill.md`，其次才是 `/state` 和更深层 endpoint。

只有在做 MDP 拓扑排障或全局能力盘点时，才建议不带 `clientId` 做大范围 `listPaths`。

对于 Vibe Forge 自身 UI：

- 优先把 MDP 当成第一控制面。
- 只要浏览器当前已经注入了首选 browser client，就先走这个 client。
- `ChromeDevtools` 只作为兜底，适用于 MDP 没有对应 path，或者 MDP 已经对同一个 UI 动作明确失败。
- 不要对 `打开设置页`、`收起侧边栏`、`切换会话视图`、`打开 workspace drawer` 这类已有 MDP path 的动作先走 `ChromeDevtools`。

## 过滤规则

你可以按 `clientId`、`name`、`path` 三个维度屏蔽 MDP catalog：

```yaml
mdp:
  filters:
    excludeClientIds:
      - internal-*
    excludeNames:
      - debug-*
    excludePaths:
      - /private/*
```

这些规则会同时作用于：

- 默认 `MDP` bridge 返回给 agent 的 `listClients` / `listPaths`
- Web 配置页里的 MDP 拓扑面板

## Workspace Skill Projection

Vibe Forge 会把当前 workspace 解析出的 skill 资产投影到 MDP：

- 聚合入口：`/skill.md`
- 单个 skill：`/<skill-path>/skill.md`

这层投影复用现有 workspace asset bundle 和 skill 依赖展开逻辑，不是直接扫描原始文件树。
使用时应先读取 `/skill.md` 做发现，再进入具体 skill path；不要先凭名字手拼子路径。

默认会包含：

- 项目资产根目录里的 skills
- 已启用插件提供的 skills

可以单独控制：

```yaml
mdp:
  workspaceProjection:
    enabled: true
    includeWorkspaceSkills: true
    includePluginSkills: true
    includeSkillIds:
      - skill:workspace:workspace:research:.ai/skills/research/SKILL.md
    excludeSkillIds:
      - skill:plugin:demo/audit:demo/audit:skills/audit/SKILL.md
```

## Web UI

配置页新增了 `MDP` tab，包含两块：

- `mdp` 配置编辑
- 当前连接的 MDP topology 查询面板

面板会展示：

- connections
- clients
- paths
- 被过滤隐藏的条目数量

## 第一方 Runtime Paths

当前版本会把第一方能力分别注册成多个 MDP clients。每个 client 自己拥有 root path，所以不再额外包 `/client`、`/server`、`/cli`、`/channels` 这种产品前缀。

### 浏览器运行时

- 根入口：
  - `/skill.md`
  - `/state`
- 分层 skill：
  - `/navigation/skill.md`
  - `/layout/skill.md`
  - `/session/skill.md`
  - `/panels/skill.md`
- 导航：
  - `/navigation/open`
  - `/navigation/session/open`
  - `/navigation/back`
  - `/config/open`
  - `/config/section/open`
  - `/knowledge/open`
  - `/archive/open`
  - `/automation/open`
  - `/benchmark/open`
- 布局：
  - `/layout/sidebar/state`
  - `/layout/sidebar/collapse`
  - `/layout/sidebar/expand`
  - `/layout/sidebar/open-mobile`
  - `/layout/sidebar/close-mobile`
- 会话视图：
  - `/session/state`
  - `/session/view/set`
  - `/session/settings/open`
  - `/session/settings/close`
- 面板：
  - `/panels/terminal/open`
  - `/panels/terminal/close`
  - `/panels/workspace/open`
  - `/panels/workspace/close`
  - `/panels/workspace/file/open`
  - `/panels/workspace/file/select`
  - `/panels/workspace/file/close`

浏览器运行时现在带一层前端 AI pointer 执行反馈。外部 agent 调的仍然是语义动作，Vibe Forge 前端只把这些动作映射到稳定 UI anchor，不暴露坐标点击和图像识别接口。

### CLI 运行时

- 根入口：
  - `/skill.md`
  - `/state`
  - `/startup`
- 分层 skill：
  - `/input/skill.md`
  - `/interaction/skill.md`
  - `/process/skill.md`
- 写入与控制：
  - `/input/send`
  - `/interaction/respond`
  - `/process/interrupt`
  - `/process/stop`
  - `/process/kill`

### 服务端运行时

- 根入口：
  - `/skill.md`
- 分层 skill：
  - `/sessions/skill.md`
  - `/workspace/skill.md`
  - `/worktree-environments/skill.md`
  - `/automation/skill.md`
  - `/benchmark/skill.md`
  - `/config/skill.md`
  - `/catalog/skill.md`
  - `/interactions/skill.md`
- 主要路径：
  - `/sessions`
  - `/sessions/archived`
  - `/sessions/create`
  - `/sessions/:session_id`
  - `/sessions/:session_id/messages`
  - `/sessions/:session_id/update`
  - `/sessions/:session_id/delete`
  - `/sessions/:session_id/fork`
  - `/sessions/:session_id/messages/:message_id/branch`
  - `/sessions/:session_id/events/publish`
  - `/sessions/:session_id/queued-messages/*`
  - `/sessions/:session_id/workspace/*`
  - `/sessions/:session_id/git/*`
  - `/workspace/*`
  - `/worktree-environments/*`
  - `/automation/*`
  - `/benchmark/*`
  - `/config`
  - `/config/schema`
  - `/config/schema/generate`
  - `/config/update`
  - `/catalog/*`
  - `/interactions/*`

这一层优先复用现有 server service / db 能力，不再维护一套完全独立的业务实现。

### Channel 运行时

- 根入口：
  - `/skill.md`
- type skill：
  - `/<type>/skill.md`
- instance skill：
  - `/<type>/<channelInstanceKey>/skill.md`
- instance 路径：
  - `/<type>/<channelInstanceKey>/state`
  - `/<type>/<channelInstanceKey>/bindings`
  - `/<type>/<channelInstanceKey>/contexts`
  - `/<type>/<channelInstanceKey>/search-sessions`
  - `/<type>/<channelInstanceKey>/commands`
  - `/<type>/<channelInstanceKey>/schemas`
  - `/<type>/<channelInstanceKey>/bind-session`
  - `/<type>/<channelInstanceKey>/unbind-session`
  - `/<type>/<channelInstanceKey>/reset-session`
  - `/<type>/<channelInstanceKey>/stop-session`
  - `/<type>/<channelInstanceKey>/restart-session`
  - `/<type>/<channelInstanceKey>/preferences`
  - `/<type>/<channelInstanceKey>/run-command`
  - 对支持发送的 channel，还会额外暴露 `send-message`、`update-message`、`send-file`、`push-follow-ups`

`channelInstanceKey` 不是原始展示名，而是从 `channels.<key>` 配置 key 推导出的稳定 path segment；同一类型下如果出现重复，会自动追加数字后缀。

其中：

- `contexts` 返回这个 channel instance 下已观察到的会话上下文，按 `sessionType + channelId` 聚合，包含绑定状态和偏好。
- `search-sessions` 返回可绑定的会话列表，支持 `query`、`limit`、`offset`，并可附带 `sessionType + channelId` 判断当前上下文是否已绑定。
- `commands` 返回结构化 command catalog，包含 usage、permission、参数和 choices。
- `schemas` 返回常用请求体的 schema 摘要，至少包含 `bindSession`、`preferences`、`runCommand`，支持发送的 channel 还会带上 `sendMessage`；支持的 channel 还会进一步带上 `updateMessage`、`sendFile`、`pushFollowUps`。
- `bind-session`、`unbind-session`、`reset-session`、`stop-session`、`restart-session` 提供高频会话控制面，不再要求 agent 先拼字符串命令。
- `preferences` 用来设置或清除 channel-scoped `adapter`、`permissionMode`、`effort`；字段显式传 `null` 表示清除。
- 对所有带 target 的写操作，先读 `/contexts` 发现真实的 `sessionType + channelId`，不要猜。
- 优先使用 direct endpoint；`run-command` 只在还没有结构化 path 的旧命令场景下作为兜底。
- `run-command` 会在一个 synthetic channel context 里执行现有频道指令，body 至少需要：

```json
{
  "command": "/help session",
  "target": {
    "sessionType": "direct",
    "channelId": "<channel-id>"
  }
}
```

例如 `bind-session` 现在推荐：

```json
{
  "sessionId": "<session-id>",
  "target": {
    "sessionType": "direct",
    "channelId": "<channel-id>"
  }
}
```

这里的 `target` 很重要。同一个 channel instance 下可能存在多个聊天上下文，所以绑定、解绑、权限和偏好更新都必须显式指定 `sessionType + channelId`。这些上下文现在会按 `channelType + channelInstanceKey + sessionType + channelId` 归属到具体实例，不再把同类型不同实例混在一起。

## 当前边界

这轮实现已经落了这些能力：

- 默认 MDP bridge 注入
- workspace skills 投影到 MDP
- server 侧 topology 查询 API 与配置页展示
- `apps/client` 浏览器 runtime 注册
- `apps/cli` 长生命周期 runtime 注册
- `apps/server` 只读 runtime 注册
- `channels/*` 的实例级 MDP path 注册
- `channels/*` 的结构化 command catalog、direct session control endpoints 与 synthetic command execution
- 配置更新后的 channel 重建与 server/runtime reload
