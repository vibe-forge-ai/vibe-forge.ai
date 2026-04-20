---
rfc: 0002
title: Model Drive Protocol 原生集成
status: draft
authors:
  - Codex
created: 2026-04-18
updated: 2026-04-20
targetVersion: vNext
futureIssue: https://github.com/vibe-forge-ai/vibe-forge.ai/issues/147
---

# RFC 0002: Model Drive Protocol 原生集成

## Summary

基于 `modeldriveprotocol` `v2.2.0`，为 Vibe Forge 引入一套原生 MDP 集成层。

本 RFC 是一个明确的 breaking change。

本 RFC 的核心目标有六个：

- 废弃 `@vibe-forge/mcp` 以及仓库内以 `mcpServers` 为中心的第一方能力模型。
- 在 `apps/client`、`apps/server`、`apps/cli` 和 `channels/*` 所在的 runtime 中直接嵌入 MDP client，而不是继续扩展 session companion MCP。
- 提供多连接、多 host 的 MDP 配置模型，并把这套配置暴露到配置页。
- 将现有 `@vibe-forge/mcp` 的 task / interaction / utility 能力全部迁移为 MDP path。
- 将 channel 能力按 MDP 的设计理念重组为 path catalog 和 skill catalog，不再为新 channel 继续编写 MCP 工具面。
- 将项目资产根目录下的 skill 资产与插件 skill 资产自动投影为 MDP skill catalog，让项目资产目录成为第一方网络映射入口。

这次设计基于 MDP 当前的官方约束：

- 外部 host 看到的是稳定 bridge：`listClients`、`listPaths`、`callPath`、`callPaths`。
- capability owner 是 runtime 本身，不是中间 proxy。
- 官方 JavaScript client 一次只连接一个 `serverUrl`。
- 官方 `@modeldriveprotocol/server` CLI 本身是 `MDP server + cluster participant + MCP bridge`。

因此，Vibe Forge 需要补的是一层自己的多连接 runtime、host bridge 和 path-level 权限模型，而不是把所有能力继续塞进 `packages/mcp` 或 channel companion MCP。

## Motivation

当前主干已经有两套相关机制：

- workspace 级默认 MCP 注入，见 `packages/config` 和 `packages/workspace-assets`
- session companion MCP 注入，见 `runtimeMcpServers` 和 `packages/channels/lark/src/mcp`

这两套机制都能工作，但它们不是 MDP 的原生模型。

如果继续把 MDP 当成“再加一层 MCP tools”来接，会产生几个问题：

- `packages/mcp` 会变成 MDP 的二次抽象层，与官方固定 bridge 重叠。
- `apps/client` 无法成为真正的 capability owner，页面状态、路由状态、当前 session 这些浏览器侧能力会被错误地经由 server 代持。
- channel 能力会继续分裂成两套：一套 MCP companion，一套 MDP catalog。
- `clientId`、`name`、`path` 过滤只能停留在 UI 层，无法自然作用于默认 host bridge。
- 官方 client 只有单一 `serverUrl`；如果我们不补多连接封装，就无法满足一个 runtime 同时接多组 MDP server host 的需求。

用户侧的新要求也进一步说明需要重新设计：

- path 不需要额外加 `/vf` 这类 root prefix。
- 一个 runtime 不应只能连一个 host 上的 MDP server。
- 要有正式配置方式，而不是散落 env 或硬编码。
- `lark` 等 channel 不应继续新增 MCP，而应适配为 MDP endpoint + skill。

## Goals

- 新增一个单独的 `mdp` 配置段，承载 connection、runtime 绑定、host bridge、过滤规则、path 权限和 UI 查询配置。
- 新增 `packages/mdp/` 作为共享 MDP 集成层。
- 删除 `packages/mcp` 在第一方运行链路中的角色。
- 将 `Wait`、`AskUserQuestion`、`StartTasks`、`ListTasks`、`GetTaskInfo`、`SubmitTaskInput`、`RespondTaskInteraction`、`StopTask` 全部迁移为 MDP path。
- 支持一个逻辑 connection 下配置多个 `hosts`，用于探测、冗余和故障切换。
- 支持一个 runtime 同时连接多个独立 connection。
- `apps/client` 直接使用官方 browser client。
- `apps/server` 只暴露 query-only server 能力；不把 server 设计成主 MDP hub。
- `apps/cli` 在长生命周期 CLI runtime 中注册自己的 MDP client。
- channel 能力统一迁移到 MDP path + skill，不再新增 channel MCP。
- 为多 tab、多进程、多 channel instance 定义稳定且不冲突的 `clientId` 规则。
- 配置页提供 MDP 配置、拓扑查询和 `clientId/name/path` 屏蔽规则编辑。
- 默认 host bridge 和 UI 查询都遵循同一套过滤规则。
- 将第一方能力权限从“按 MCP server 名称”切换到“按 MDP path pattern”。
- 将项目资产根目录下的 `skills/*/SKILL.md` 和插件 skill 资产按固定路径规则注册到 MDP，并通过 MDP `skill.md` 路径直接被 agent 发现与读取。

## Non-Goals

- 不在 V1 实现 MDP server 的自研协议替代品；底层仍依赖官方 `@modeldriveprotocol/server` 与 `@modeldriveprotocol/client`。
- 不把 `state-store` 作为 cluster 事实源或恢复机制。
- 不在 V1 提供完整的 path 调试器 UI。
- 不在 V1 保留第一方 `mcpServers` 作为正式配置入口。
- 不在 V1 支持“原样透传任意第三方 MCP server 配置”这套旧模型。
- 不在 V1 默认放开 MDP path 权限。

## Background

### Vibe Forge 当前边界

当前仓库有几个现成边界：

- 默认 `VibeForge` MCP 注入链路：
  - `packages/config/src/default-vibe-forge-mcp.ts`
  - `packages/workspace-assets/src/bundle-internal.ts`
- session companion MCP 链路：
  - `packages/types/src/adapter.ts`
  - `packages/task/src/run.ts`
  - `apps/server/src/services/session/index.ts`
- channel companion MCP 现状：
  - `packages/channels/lark/src/mcp/index.ts`
- 第一方 MCP 工具现状：
  - `packages/mcp/src/tools/general/wait.ts`
  - `packages/mcp/src/tools/interaction/ask-user.ts`
  - `packages/mcp/src/tools/task/index.ts`
  - `packages/mcp/src/tools/task/register-task-runtime-tools.ts`
- workspace skill 与 workspace 资产发现链路：
  - `packages/workspace-assets/src/bundle-internal.ts`
  - `packages/workspace-assets/src/bundle.ts`
  - `packages/workspace-assets/src/skill-dependencies.ts`
  - `packages/workspace-assets/src/workspaces.ts`
  - `packages/definition-core/src/index.ts`
- 配置页 section / schema / 路由：
  - `packages/types/src/config.ts`
  - `packages/config/src/update.ts`
  - `apps/server/src/routes/config.ts`
  - `apps/client/src/components/ConfigView.tsx`
  - `apps/client/src/components/config/configSchema.ts`

本 RFC 要对这些边界做一次破坏性收敛：MCP 不再是第一方能力模型，只保留 host bridge 的 transport 角色。

### MDP 当前官方模型

本 RFC 以 `modeldriveprotocol` `v2.2.0` 为准。

关键信息：

- 官方 bridge 始终是稳定的四个 MCP tools。
- browser 和 node 都是一等 client runtime。
- server 只是薄索引层和路由层，不是 capability owner。
- cluster 解决的是 registry 和 routing 的 leader/follower 问题，不复制 live client session。
- `state-store` 是 node-local 诊断快照。

官方资料：

- [Model Drive Protocol v2.2.0](https://github.com/modeldriveprotocol/modeldriveprotocol/releases/tag/v2.2.0)
- [MCP Bridge](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/protocol/mcp-bridge.md)
- [Embedding](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/client/embedding.md)
- [JavaScript Usage](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/sdk/javascript/usage.md)
- [Deployment Modes](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/server/deployment.md)
- [State Store](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/server/state-store.md)

## Design Constraints

### 1. 不引入额外 root path

MDP 的 path scope 天然是“按 client 隔离”的。

因此：

- 不再给路径统一加 `/vf/...`
- path 直接写业务前缀即可：
  - `/client/...`
  - `/server/...`
  - `/cli/...`
  - `/channels/<type>/<instance>/...`

额外 vendor root prefix 只会增加冗余，不带来额外隔离价值。

### 2. 一个官方 client 只连一个 `serverUrl`

官方 SDK 的 `createMdpClient()` 输入是单个 `serverUrl`。

因此 Vibe Forge 要支持多 host / 多连接，只能在自己这层补两类能力：

- host 解析与去重
- 多 client manager

不能指望官方 client 直接吃 `serverUrls[]`。

### 3. 多个 host 和多个 connection 不是一个概念

本 RFC 明确区分：

- `hosts[]`：同一个逻辑 connection 下的多个候选 MDP server host
- `connections`：多个独立的逻辑 MDP connection

设计意图：

- 一个 `connection` 应该对应一个逻辑 cluster
- 同一个 `connection` 下的多个 `hosts` 用于冗余、故障切换和就近接入
- 如果多个 `hosts` 解析到不同 cluster，则视为配置错误
- 如果一个 runtime 同时需要连接多个 cluster，应声明多个 `connections`

### 4. channel 走 MDP，不再新增 MCP

对 channel 来说，MCP companion 只是现状，不是未来方向。

未来规则：

- 不再为新 channel 继续写 `src/mcp/*`
- channel 能力按 MDP path catalog 和 skill catalog 暴露
- 现有 channel companion MCP 仅作为迁移兼容层

### 5. 同类型 channel 可能有多个实例

同一个 `type` 下可能存在多个 channel 实例，例如多个 `lark` 配置。

因此 channel path 不能只到 `/channels/<type>/...`，而应到实例级：

- `/channels/<type>/<channel-instance>/...`

这里的 `<channel-instance>` 不使用展示名，也不直接使用未处理的原始 key，而使用从配置 key 推导出的稳定 path segment。

原因：

- 展示名可变且不唯一
- 原始 config key 可能包含不适合直接放入 path 的字符
- path segment 必须在重启后保持稳定，不能依赖运行时随机值

### 6. host bridge 仍然存在，但不再是产品抽象

当前主流 agent host 仍然通过 MCP 挂载外部工具。

因此 breaking 后仍会存在一个“MCP bridge 进程”，但它的定位变化为：

- 它只是 host transport edge
- 它不再定义第一方 capability
- 它不再是用户配置中心
- 它不再是仓库内部组织能力的抽象单位

换句话说：

- 第一方 capability 只定义为 MDP path / prompt / skill
- host 最终看到的 MCP surface 只是由 `packages/mdp` 动态派生出来的桥

### 7. 旧权限模型不够用了

当前权限模型主要按 MCP server 名称归类。

在“所有能力都收敛到一个 MDP bridge”的设计下，这会退化成：

- 允许一个 bridge
= 允许整张 capability catalog

这是不可接受的。

因此 breaking 版本必须同步切到 path-level 权限模型。

## Proposed Design

### Overview

新增 `packages/mdp/`，统一承载：

- MDP config schema 与解析
- host 解析和 cluster 去重
- runtime client manager
- 默认 host bridge CLI
- server 查询服务
- channel MDP provider 定义工具

总结构：

```text
packages/mdp/
  src/config.ts
  src/host-resolution.ts
  src/cluster-dedupe.ts
  src/runtime/client-manager.ts
  src/workspace-projection/index.ts
  src/workspace-projection/skills.ts
  src/runtime/browser.ts
  src/runtime/node.ts
  src/query/service.ts
  src/mcp/server.ts
  src/mcp/query-bridge.ts
  src/channel.ts
  cli.ts
```

`packages/mcp` 从第一方主运行链路中移除。

### Default Host Bridge

breaking 版本不再有“默认 `VibeForge` MCP”这个产品概念。

替代物是默认 host bridge。

实现方式：

- 在 `packages/workspace-assets` 中新增默认内置 host bridge 注入逻辑
- 生成的 command 指向 `@vibe-forge/mdp/cli`
- CLI 本身暴露 MCP stdio surface
- CLI 内部再根据 `mdp.connections` 配置去查询和调用目标 MDP 网络
- CLI 同时负责启动 workspace projection client，把当前有效 workspace 的 skill 资产注册到目标 MDP connection

这样做的原因有三个：

- 需要支持多 host 解析
- 需要支持 `clientId/name/path` 过滤
- 需要让默认 host bridge 和 UI 查询共享同一套连接解析逻辑

命名规则：

- 如果只启用一个默认 connection，bridge 名称为 `mdp`
- 如果启用多个 connection，bridge 名称为 `mdp-<connectionKey>`

默认不会自动加入 `permissions.allow`，而是受 MDP path 权限控制。

### Host Bridge 行为

`@vibe-forge/mdp/cli` 对外仍然提供标准四个 tools：

- `listClients`
- `listPaths`
- `callPath`
- `callPaths`

但内部不是直接把 stdio 交给一个固定的官方 `@modeldriveprotocol/server` 进程，而是做两层包装：

1. 解析当前 connection 配置，选出健康目标 host
2. 为该 connection 启动或复用一个 query bridge worker

query bridge worker 使用官方 `@modeldriveprotocol/server` CLI，以 `proxy-required` 模式接入目标 host：

```text
@modeldriveprotocol/server \
  --cluster-mode proxy-required \
  --upstream-url <selected-ws-endpoint>
```

wrapper 再通过 MCP client 调这个 worker 的四个 bridge tools，并在返回前应用：

- connection 解析
- path 过滤
- path 权限检查

这样可以同时满足：

- 官方 bridge surface 不变
- Vibe Forge 可控制多 host 解析
- 过滤规则能作用到默认 host bridge
- server 查询和默认 host bridge 使用相同的桥接逻辑

### Host Resolution

每个 connection 都支持多个 `hosts`。

`packages/mdp` 的 host resolution 规则：

1. 依次探测每个 host 的 `/mdp/meta`
2. 验证协议版本兼容
3. 收集 `cluster.id`、`serverId`、`leaderUrl`
4. 如果同一 connection 下解析到多个不同的 `cluster.id`，报配置错误
5. 如果解析到同一个 cluster 的多个 host，按声明顺序选择优先目标
6. 记录当前选中的 host，并在失效时切换到下一个健康 host

一个 runtime 如果绑定了多个 connection，再按 connection 维度分别创建 client 或 query worker。

如果多个 connection 最终解析到同一个 `cluster.id`，运行时去重并发出 warning，避免同一 runtime 用同一 `clientId` 重复注册到同一个 cluster。

### Configuration

新增独立 `mdp` section。

建议 schema：

```ts
interface MdpConnectionConfig {
  enabled?: boolean
  hosts: string[]
  auth?: {
    scheme?: string
    token?: string
    headers?: Record<string, string>
    metadata?: Record<string, unknown>
  }
  expectedClusterId?: string
  connectTimeoutMs?: number
  queryMode?: 'proxy-required'
}

interface MdpRuntimeBindingConfig {
  enabled?: boolean
  connections?: string[]
}

interface MdpChannelBindingConfig {
  defaultConnections?: string[]
  overrides?: Record<string, string[]>
}

interface MdpHostBridgeConfig {
  enabled?: boolean
  connections?: string[]
}

interface MdpWorkspaceProjectionConfig {
  enabled?: boolean
  connections?: string[]
  includeWorkspaceSkills?: boolean
  includePluginSkills?: boolean
  includeSkillIds?: string[]
  excludeSkillIds?: string[]
  syncMode?: 'startup' | 'watch'
}

interface MdpFiltersConfig {
  excludeClientIds?: string[]
  excludeNames?: string[]
  excludePaths?: string[]
}

interface MdpPathPermissionConfig {
  allowPaths?: string[]
  askPaths?: string[]
  denyPaths?: string[]
}

interface MdpConfig {
  connections?: Record<string, MdpConnectionConfig>
  runtimes?: {
    client?: MdpRuntimeBindingConfig
    server?: MdpRuntimeBindingConfig
    cli?: MdpRuntimeBindingConfig
    channels?: MdpChannelBindingConfig
  }
  hostBridge?: MdpHostBridgeConfig
  workspaceProjection?: MdpWorkspaceProjectionConfig
  filters?: MdpFiltersConfig
  permissions?: MdpPathPermissionConfig
}
```

其中 `hosts` 支持 `ws://`、`wss://`、`http://`、`https://` base URL。

对于 `http(s)` host，运行时应先通过 `/mdp/meta` 解析出对应的 `endpoints.ws`，再把它作为 query bridge worker 的 `--upstream-url`。

示例：

```json
{
  "mdp": {
    "connections": {
      "local": {
        "hosts": [
          "ws://127.0.0.1:47372",
          "ws://127.0.0.1:47373"
        ]
      },
      "shared": {
        "hosts": [
          "wss://mdp-a.internal.example.com",
          "wss://mdp-b.internal.example.com"
        ],
        "auth": {
          "scheme": "Bearer",
          "token": "${MDP_SHARED_TOKEN}"
        },
        "expectedClusterId": "vf-shared"
      }
    },
    "runtimes": {
      "client": {
        "enabled": true,
        "connections": ["local", "shared"]
      },
      "server": {
        "enabled": true,
        "connections": ["local"]
      },
      "cli": {
        "enabled": true,
        "connections": ["local"]
      },
      "channels": {
        "defaultConnections": ["local"],
        "overrides": {
          "default": ["local", "shared"]
        }
      }
    },
    "hostBridge": {
      "enabled": true,
      "connections": ["local", "shared"]
    },
    "workspaceProjection": {
      "enabled": true,
      "connections": ["local", "shared"],
      "includeWorkspaceSkills": true,
      "includePluginSkills": true,
      "excludeSkillIds": ["internal/*"],
      "syncMode": "watch"
    },
    "filters": {
      "excludeClientIds": ["playground-*"],
      "excludeNames": ["Docs Playground"],
      "excludePaths": ["/debug/*"]
    },
    "permissions": {
      "allowPaths": [
        "/client/state",
        "/server/sessions",
        "/tasks",
        "/tasks/:taskId"
      ],
      "askPaths": [
        "/client/open-*",
        "/cli/*",
        "/channels/*/messages/*",
        "/tasks/run",
        "/tasks/:taskId/stop"
      ],
      "denyPaths": [
        "/debug/*"
      ]
    }
  }
}
```

配置持久化和前端编辑走新的 `mdp` section，而不是塞进现有 `mcp` section。

`workspaceProjection.connections` 默认继承 `hostBridge.connections`。

这样：

- bridge 启动时就能把 workspace skill surface 注册进 MDP
- 不需要再在 `.ai.config.json` 里重复声明一次同样的 connection 列表
- 如果某些 skill 只希望投影到部分 connection，也可以显式覆盖

`workspaceProjection` 的扫描根默认跟随当前有效 workspace 的项目资产根目录，而不是硬编码 `.ai`。

也就是说：

- 若项目使用默认资产根目录，则仍然是 `./.ai/skills`
- 若项目通过 `baseDir` 或环境变量改了资产根目录，projection 也跟着变
- 若当前运行的是 workspace 子任务，则 projection 以子 workspace 的 `cwd` 和其本地配置为准

其中 `runtimes.channels.overrides` 的 key 使用原始 `channels.<key>` 配置 key，而不是 path 里的 `channelInstanceKey`，因为前者才是配置写入和 merge 时的稳定主键。

同时，以下旧字段在 breaking 版本中废弃并删除：

- `Config.mcpServers`
- `Config.defaultIncludeMcpServers`
- `Config.defaultExcludeMcpServers`
- `Config.noDefaultVibeForgeMcpServer`
- `AdapterQueryOptions.mcpServers`
- `AdapterQueryOptions.runtimeMcpServers`

适配器不再接收“用户显式挑选 MCP server 列表”的输入，而是只接收由 MDP 配置派生出的 host bridge 计划。

### MDP Client Identity

官方 MDP server 对同一 cluster 内的重复 `clientId` 采用“新连接替换旧连接”的语义。

因此 Vibe Forge 必须避免以下冲突：

- 同一浏览器开多个 tab
- 同一 workspace 启多个 CLI 进程
- 同类型 channel 存在多个实例
- 同一 runtime 绑定多个 connection

V1 采用“每个 runtime instance、每个 connection 各注册一个 client”的规则，并显式定义 `clientId` 组成。

#### Client ID 组成

建议格式：

```text
vf.<runtimeKind>.<scope>.<connectionKey>
```

其中：

- `<runtimeKind>` 取 `client` / `server` / `cli` / `channel`
- `<scope>` 取该 runtime 的稳定实例标识
- `<connectionKey>` 取当前绑定的 connection key

建议 scope 规则：

- `apps/server`：`<workspaceHash>`
- `apps/client`：`<workspaceHash>.<browserInstanceId>`
- `apps/cli`：`<workspaceHash>.<sessionId>`
- `channels/*`：`<workspaceHash>.<type>.<channelInstanceKey>`

示例：

- `vf.server.a1b2c3.local`
- `vf.client.a1b2c3.tab7f92.local`
- `vf.cli.a1b2c3.sess019f.local`
- `vf.channel.a1b2c3.lark.default.shared`

#### Browser Instance ID

`apps/client` 的 `browserInstanceId` 需要做到：

- 同一 tab 刷新后保持稳定
- 不同 tab 不冲突
- 不依赖服务端分配

建议实现：

- 优先使用 `sessionStorage`
- key 例如 `vf.mdp.browserInstanceId`
- 若当前环境不可用 `sessionStorage`，则退回页面生命周期内的内存随机值

这样：

- 同一 tab reload 不会换 `clientId`
- 新开 tab 会得到新的 `clientId`

#### Connection 去重后的注册规则

如果多个配置的 connection 最终解析到同一个 cluster：

- runtime manager 只保留一个有效注册
- 被去重的 connection 不注册第二个 client
- UI 和日志明确提示 `connectionKey -> clusterId` 的去重结果

这样可以避免同一 runtime 因配置重复而自相冲突。

### Runtime Client Ownership

#### `apps/client`

`apps/client` 直接使用 `@modeldriveprotocol/client/browser`。

它拥有真正的浏览器状态，因此应暴露：

- `GET /client/state`
- `POST /client/open-route`
- `POST /client/open-session`
- `POST /client/open-workspace-file`
- `GET /client/routes`
- `/client/skill.md`
- `/client/navigation/skill.md`

客户端 metadata 推荐包含：

- 当前 route
- 当前 active session id
- workspace 标识
- client base

路由变化和 active session 变化时：

- metadata 变化走 `register(overrides)`
- path catalog 变化走 `syncCatalog()`

#### `apps/server`

`apps/server` 只暴露 query-only server 能力：

- `GET /server/sessions`
- `GET /server/sessions/:sessionId`
- `GET /server/config`
- `GET /server/channels`
- `GET /server/workspaces`
- `GET /server/worktree-environments`
- `/server/skill.md`

不在 server provider 中加入创建会话、终止进程、打开页面等副作用能力。

server 额外承担一个职责：为配置页提供 MDP 查询 API。

但这个“查询 API”不等于“server 自己是主 MDP hub”。它只是通过 `packages/mdp` 的 query bridge worker 去读远端连接状态。

另外，当前 `packages/mcp` 里的第一方 task / interaction / utility 能力也迁移到 server-owned MDP client：

- `POST /tasks/run`
- `GET /tasks`
- `GET /tasks/:taskId`
- `POST /tasks/:taskId/input`
- `POST /tasks/:taskId/interaction-response`
- `POST /tasks/:taskId/stop`
- `POST /interactions/ask-user`
- `POST /utility/wait`
- `/tasks/skill.md`
- `/interactions/skill.md`

#### `apps/cli`

CLI 应在真正拥有进程和启动参数的 runtime 中注册自己，而不是由 server 假装代持。

首版暴露：

- `GET /cli/session`
- `GET /cli/startup`
- `POST /cli/stop`
- `POST /cli/kill`
- `/cli/skill.md`

这些能力直接复用 CLI session cache 与 signal 控制逻辑。

#### `channels/*`

channel 按 MDP path + skill 暴露，不再新增 MCP。

以 `lark` 为例：

- `GET /channels/lark/default/bindings`
- `GET /channels/lark/default/context`
- `POST /channels/lark/default/messages/send`
- `POST /channels/lark/default/messages/reply`
- `GET /channels/lark/default/messages/history`
- `/channels/lark/default/skill.md`
- `/channels/lark/default/messages/skill.md`
- `/channels/lark/default/bindings/skill.md`

channel root skill 负责说明：

- 先读哪个 skill
- 哪些 endpoint 有副作用
- 推荐的调用顺序
- 当前 connection / binding 的限制条件

这比 MCP 工具列表更符合 MDP 的 progressive disclosure 模型。

### Workspace Network Mapping

项目资产根目录在 breaking 后不再只是“给 prompt 拼装器读的本地目录”，而是第一方 capability 的 declarative source。

V1 只做一类自动投影：

- `skills/*/SKILL.md`
- 插件 skill 资产

也就是说，workspace network mapping 的首个落点是 skill catalog，而不是把资产目录下所有文件都粗暴挂到网络上。

原因：

- `SKILL.md` 本身已经符合 MDP 官方推荐的 `.../skill.md` 模型
- 仓库已经有稳定的 skill 资产发现和命名逻辑
- skill 是可读 guidance，不需要额外定义输入输出 schema
- 把规则、spec、任意文件直接暴露成网络 surface 会过快扩大兼容面

未来如果要扩展 `specs`、`entities` 或其他目录，也应沿着同一套“先归一化为资产，再投影为 path”模型做，而不是直接按文件系统遍历结果上网。

### Workspace Skill Projection

workspace skill projection 不直接重新扫描原始文件树，而是复用现有 workspace asset pipeline 产出的 skill 资产。

这样可以直接复用：

- workspace skill 发现
- 插件 skill 发现
- skill dependency 展开
- registry 下载与缓存
- workspace target 的重新定根逻辑
- `resolveSkillIdentifier()` 的命名规则
- 后续插件覆盖与 merge 语义

投影 owner 为默认 host bridge CLI。

也就是说，`@vibe-forge/mdp/cli` 在启动 MCP bridge 之前，会先：

1. 解析当前有效 workspace 的配置与资产目录
2. 通过 `resolveWorkspaceAssetBundle()` 读取 workspace 资产快照
3. 提取其中的 `skill` 资产
4. 按与 prompt 选择一致的规则展开 skill dependencies，必要时从 registry 安装依赖
5. 按 `workspaceProjection` 配置做 include / exclude
6. 将结果注册到目标 MDP connection
7. 在 `syncMode = watch` 时监听 skill 资产变化并执行 `syncCatalog()`

这里的“注册 skill”只暴露 MDP skill path，不把 `SKILL.md` 当作可执行 endpoint。

这点必须明确：

- `GET /skills/.../skill.md` 的作用是读取 guidance
- 真正会产生副作用的动作，仍然应该注册为 endpoint path 或 prompt path
- skill 文档负责把 agent 引导到正确的 endpoint / prompt，而不是自己承担写操作

这也是 MDP 官方 skill / endpoint 分层的原意。

这套投影必须与现有 prompt/runtime 使用同一份 skill 图，而不是各自重新解析一遍。

否则会出现两类不一致：

- prompt 已经拿到了依赖 skill，但 MDP `/skills/.../skill.md` 看不到
- MDP 已暴露 registry dependency，但 adapter prompt 还没装入同一依赖

因此 workspace projection 的输入应是“已归一化、已展开的 workspace asset bundle”，不是原始文件系统扫描结果。

### Workspace Skill Path Rule

workspace projection 为所有 skill 资产生成统一路径：

- 聚合入口：`/skills/skill.md`
- 单个 skill：`/skills/<skillPath>/skill.md`

其中 `<skillPath>` 基于现有 skill identifier 生成：

1. 先取 skill 资产的规范化 identifier
2. 若 identifier 含 `/`，按 path segment 拆开
3. 每个 segment 转为 path-safe slug
4. 最终拼回 `/skills/<segments...>/skill.md`

示例：

- `<asset-root>/skills/research/SKILL.md` -> `/skills/research/skill.md`
- `<asset-root>/plugins/reviewer/vibe-forge/skills/review/SKILL.md` 且 identifier 为 `reviewer/review` -> `/skills/reviewer/review/skill.md`
- npm 插件 skill `demo/audit` -> `/skills/demo/audit/skill.md`

`/skills/skill.md` 由 projector 动态生成，内容至少包含：

- 当前已投影的 skill 列表
- 每个 skill 的简短 description
- 对应子 skill path 的链接
- 一句说明：可执行动作不在 skill 下直接定义，应继续读取对应 skill 中指向的 endpoint / prompt path

单个 skill path 返回的 Markdown 以原始 `SKILL.md` 为主体，并追加一小段标准头信息：

- skill identifier
- source path
- origin：workspace / plugin

这样可以保留现有 skill 文档的写法，同时让 agent 通过 MDP 知道这是从哪来的。

### Effective Workspace Boundary

新主干已经把 workspace 作为一等调度目标。

这意味着 MDP projection 和 runtime registration 都不能偷懒地绑定在“仓库根目录”这个单点上，而必须跟随当前有效 workspace：

- 在仓库根目录启动的主 runtime，投影根 workspace 自己的资产
- 以 `workspace` 目标启动的子任务，重新以目标 workspace 的 `cwd` 解析配置、skills、plugins 与 projection
- 同一仓库下不同 workspace 的 skill surface 可以不同，这是预期行为，不是冲突

因此：

- `workspaceProjection` 的实现应基于 `cwd` 重新加载配置
- `clientId` scope 建议额外包含 workspace 标识，避免不同 workspace 误判为同一 client
- server 查询 UI 需要能显示“当前 connection 下这个 client 属于哪个 workspace”

### Channel Integration Model

新增 channel MDP 子入口约定：

```text
@vibe-forge/channel-<type>/mdp
```

子入口负责声明 channel 的 MDP capability definitions，不负责连接管理。

server 侧 channel manager 负责：

- 解析 channel 配置
- 选择 connection
- 为每个 channel 实例生成稳定的 path-safe `channelInstanceKey`
- 为每个 `channelInstanceKey + connectionKey` 生成稳定 `clientId`
- 创建或复用 channel MDP client
- 把 channel provider 注册到对应 connection

这保持了现有仓库的分层：

- channel package 仍然只是扩展实现层
- orchestration 仍由 `apps/server` 和共享 runtime 层负责

### Repository Breaking Surface

为实现“所有第一方能力通过 MDP 承接”，仓库内需要同步做以下 breaking changes：

- `packages/mcp` 从主运行链路移除
- `packages/app-runtime` 不再依赖 `@vibe-forge/mcp`
- `packages/types` 中删除第一方 `mcpServers` 配置面
- `packages/workspace-assets` 中 `mcpServer` 资产类型重构为 host bridge 资产
- `packages/task` 不再基于 `mcpServers/runtimeMcpServers` 选择 companion MCP
- `apps/server/src/channels/loader.ts` 不再解析 `@vibe-forge/channel-<type>/mcp`，改解析 `@vibe-forge/channel-<type>/mdp`
- `packages/channels/lark/src/mcp/*` 标记废弃并迁移到 `src/mdp/*`
- 配置页删除 `MCP` tab，替换为 `MDP` tab

### Query API and UI

配置页新增独立 `MDP` tab。

服务端 API：

- `GET /api/mdp/connections`
- `GET /api/mdp/connections/:key/clients`
- `GET /api/mdp/connections/:key/paths`
- `GET /api/mdp/connections/:key/health`

UI 展示内容：

- connection 列表与当前选中的 host
- cluster id / leader id / leader url
- 当前 clients
- 当前 paths
- 过滤命中数量与命中原因

UI 查询统一走 server API，不直接在浏览器里调用 bridge。

### Channel Instance Path Key

channel 的 canonical path 采用：

```text
/channels/<type>/<channelInstanceKey>/...
```

其中：

- `<type>` 取 channel descriptor 的 `type`
- `<channelInstanceKey>` 取自当前 workspace `channels` 配置记录 key 的稳定 path-safe 映射

建议规则：

1. 以 `channels.<key>` 的 key 作为原始实例标识
2. 转小写
3. 将非 `a-z0-9-_` 的字符折叠为 `-`
4. 去掉首尾多余 `-`
5. 若为空则回退为 `default`
6. 若同一 `type` 下出现 slug 冲突，则追加短 hash，例如 `ops--a1b2`

示例：

- `channels.default.type = "lark"` -> `/channels/lark/default/...`
- `channels.ops_cn.type = "lark"` -> `/channels/lark/ops_cn/...`
- `channels.sales bot.type = "lark"` -> `/channels/lark/sales-bot/...`

运行时 metadata 仍保留原始字段：

- `channelType`
- `channelKey`
- `channelInstanceKey`
- `title`
- `connectionKey`

其中 `channelKey` 是原始 config key，`channelInstanceKey` 是 path-safe key。

建议把这套规则收敛到共享 helper，例如：

```text
packages/mdp/src/channel-instance-key.ts
```

导出：

- `toChannelInstanceKey(type, channelKey): string`
- `buildChannelPathPrefix(type, channelInstanceKey): string`
- `buildChannelClientId(input): string`

### Filters

过滤规则支持三维：

- `clientId`
- `name`
- `path`

首版统一使用 glob 字符串数组。

生效点分三处：

1. Vibe Forge 自己的 runtime client 注册前
2. 默认 host bridge 的 bridge 返回前
3. 配置页查询 API 返回前

这样可以保证：

- 本地不注册不该暴露的 path
- agent 通过默认 host bridge 看不到被屏蔽项
- UI 与默认 host bridge 呈现同一视图

### Permissions

breaking 后，第一方 capability 不再依赖“按 MCP server 名称授权”。

原因：

- 一个 bridge 可以触达整张被接入的 capability catalog
- 单靠 bridge 名称无法表达只读 / 写入 / 危险路径的细粒度差异

因此 V1 行为：

- 默认注入 host bridge
- host bridge 在 `callPath` / `callPaths` 前按 `mdp.permissions` 做路径匹配
- `denyPaths` 优先级最高
- `askPaths` 次之
- `allowPaths` 只对命中的 path 生效
- 未命中的 path 默认按 `ask` 处理

这套规则同时作用于：

- 默认 host bridge
- server 查询 API 中的“手动调试调用”
- 后续任何第一方 bridge surface

### Existing Capability Migration

`@vibe-forge/mcp` 现有能力迁移如下：

| 旧 MCP Tool | 新 MDP Path |
| --- | --- |
| `Wait` | `POST /utility/wait` |
| `AskUserQuestion` | `POST /interactions/ask-user` |
| `StartTasks` | `POST /tasks/run` |
| `ListTasks` | `GET /tasks` |
| `GetTaskInfo` | `GET /tasks/:taskId` |
| `SubmitTaskInput` | `POST /tasks/:taskId/input` |
| `RespondTaskInteraction` | `POST /tasks/:taskId/interaction-response` |
| `StopTask` | `POST /tasks/:taskId/stop` |

## Path Contract

首版 path contract：

### Skills

- `GET /skills/skill.md`
- `GET /skills/<skillPath>/skill.md`

### Client

- `GET /client/state`
- `POST /client/open-route`
- `POST /client/open-session`
- `POST /client/open-workspace-file`
- `/client/skill.md`
- `/client/navigation/skill.md`

### Server

- `GET /server/sessions`
- `GET /server/sessions/:sessionId`
- `GET /server/config`
- `GET /server/channels`
- `GET /server/workspaces`
- `GET /server/worktree-environments`
- `/server/skill.md`

### Utility

- `POST /utility/wait`
- `/utility/skill.md`

### Interactions

- `POST /interactions/ask-user`
- `/interactions/skill.md`

### Tasks

- `POST /tasks/run`
- `GET /tasks`
- `GET /tasks/:taskId`
- `POST /tasks/:taskId/input`
- `POST /tasks/:taskId/interaction-response`
- `POST /tasks/:taskId/stop`
- `/tasks/skill.md`

### CLI

- `GET /cli/session`
- `GET /cli/startup`
- `POST /cli/stop`
- `POST /cli/kill`
- `/cli/skill.md`

### Channels

- `GET /channels/<type>/<channelInstanceKey>/bindings`
- `GET /channels/<type>/<channelInstanceKey>/context`
- `POST /channels/<type>/<channelInstanceKey>/messages/send`
- `POST /channels/<type>/<channelInstanceKey>/messages/reply`
- `/channels/<type>/<channelInstanceKey>/skill.md`
- `/channels/<type>/<channelInstanceKey>/messages/skill.md`

## Migration Plan

### Phase 1

- 新增 `packages/mdp`
- 新增 `Config.mdp`
- 默认 host bridge 注入打通
- 配置页新增 `MDP` tab
- `apps/server` 查询 API 打通

### Phase 2

- `apps/client` 接入 browser MDP client
- `apps/server` 接入 query-only server MDP client
- `packages/mcp` 里的第一方 utility / interaction / task 能力迁移到 server-owned MDP client
- `apps/cli` 接入 node MDP client

### Phase 3

- 新增 channel MDP 子入口约定
- `lark` 先迁移到 MDP endpoint + skill
- `@vibe-forge/channel-<type>/mcp` 默认关闭并标记废弃

### Phase 4

- 其他 channel 按同样模式迁移
- 删除 `packages/mcp`
- 删除 `Config.mcpServers` 相关 schema、UI、资产和 runtime 逻辑
- 清理仅为 companion MCP 保留的 channel 实现

## Testing

需要覆盖：

- host resolution：多 host 探测、cluster id 校验、故障切换
- connection 去重：多 connection 指向同一 cluster 的去重与 warning
- 默认 host bridge：单 connection 和多 connection 的 asset 注入
- workspace projection：自定义资产根目录下 `skills/*/SKILL.md` 与插件 skill 资产到 `/skills/.../skill.md` 的路径映射
- workspace projection：skill dependency 展开与 registry 安装后，MDP skill catalog 与 prompt skill graph 保持一致
- workspace projection：workspace 子任务重新定根后，skill projection 与 root workspace 相互隔离
- workspace projection watch：新增、删除、重命名 skill 后的 `syncCatalog()`
- filter：`clientId/name/path` 三维规则
- path 权限：`allow/ask/deny` 优先级和 pattern 命中
- config：load / merge / update / route / UI schema
- browser client：路由变化导致 metadata 更新
- server query：多 connection 拓扑查询
- cli client：session / startup / stop / kill
- task / interaction / utility path：与旧 `@vibe-forge/mcp` 语义对齐
- channel MDP：`lark` 的 endpoint + skill catalog

## Alternatives Considered

### 1. 保留 `@vibe-forge/mcp` 作为第一方能力层

不采用。

### 2. 直接把 `SKILL.md` 当作可执行 endpoint

不采用。

原因：

- 现有 `.ai/skills` 只有文档语义，没有稳定输入输出契约
- MDP 官方明确把 skill 和 endpoint 分开
- 把 Markdown 文档直接提升为写操作接口，会让权限、校验和兼容性边界全部失真

正确模型应是：

- `SKILL.md` 投影成 `.../skill.md`
- skill 文档指向真正的 endpoint / prompt path
- 需要结构化调用的能力，由 runtime 或 workspace projector 显式注册 endpoint

### 3. 直接把官方 `@modeldriveprotocol/server` 当默认 bridge 注入

不采用。

原因：

- 无法自然支持一个 connection 下多个 `hosts`
- 无法把过滤规则应用到默认 bridge 返回
- 无法复用同一套 host resolution 和权限逻辑到 UI 查询

### 4. 继续把 channel 能力做成 session companion MCP

不采用。

原因：

- 与 MDP 原生路径模型重复
- channel 能力会继续分叉成两套协议面
- skill 无法成为一等发现入口

### 5. 在 path 前统一加 `/vf`

不采用。

原因：

- client scope 已经足够隔离
- `/vf` 只会增加路径噪音
- 用户已明确要求不需要 root path

## Open Questions

- 是否在 V1 为 channel 常用工作流额外提供 `prompt.md`，还是先只提供 endpoint + skill。
- 是否要在配置页里直接暴露“按 connection 调用一个 path”的调试面板。
- 默认 host bridge 在多 connection 场景下，是否允许额外聚合成一个逻辑 `mdp` 入口；V1 建议不聚合，直接 `mdp-<connectionKey>`。
- `packages/mdp` 与 app runtime 的 owner-layer 边界如何收敛，以及 channel instance 是否应进一步拆成独立 MDP client；跟踪见 [Issue #147](https://github.com/vibe-forge-ai/vibe-forge.ai/issues/147)。

## References

- [Model Drive Protocol v2.2.0 Release](https://github.com/modeldriveprotocol/modeldriveprotocol/releases/tag/v2.2.0)
- [Protocol Overview](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/protocol/overview.md)
- [MCP Bridge](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/protocol/mcp-bridge.md)
- [Progressive Disclosure](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/protocol/progressive-disclosure.md)
- [Embedding](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/client/embedding.md)
- [JavaScript Usage](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/sdk/javascript/usage.md)
- [JavaScript Advanced Usage](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/sdk/javascript/advanced-usage.md)
- [Deployment Modes](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/server/deployment.md)
- [Server Overview](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/server/overview.md)
- [State Store](https://github.com/modeldriveprotocol/modeldriveprotocol/blob/v2.2.0/docs/server/state-store.md)
