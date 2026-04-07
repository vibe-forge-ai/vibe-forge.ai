本目录用于服务端频道系统的模块化实现，采用中间件管道架构处理入站消息。

## 目录结构

```
channels/
  index.ts            初始化所有频道连接，对外暴露 ChannelManager
  handlers.ts         handleInboundEvent（ctx 组装 + 管道执行）、handleSessionEvent（出站回复）
  types.ts            频道层共享类型（re-export 自 middleware/@types）
  state.ts            内存绑定状态（dedup / binding / pendingUnack）
  loader.ts           动态加载频道连接模块
  middleware/         入站消息管道
    @types/             共享类型定义
      index.ts            ChannelContext / ChannelTextMessage / ChannelMiddleware
    @utils/             通用工具函数
      index.ts            stripSpeakerPrefix / stripLeadingAtTags / getInboundContentItems
    index.ts            管道组装（compose），导出 pipeline
    deduplicate.ts      按 messageId 去重
    parse-content.ts    解析富文本内容 + 剥离 @-tag 和发言者前缀
    access-control.ts   检查 allowPrivateChat / allowGroupChat / 黑白名单
    resolve-session.ts  从 DB 查询当前 channel 绑定的 sessionId
    ack.ts              向 channel 发送「处理中」确认
    admin-gate.ts       无 session 时限制非 admin 用户创建新会话
    commands.ts         channelCommandMiddleware（/help /reset 等指令）
    bind-session.ts     持久化 channel↔session 绑定 + 内存 binding
    dispatch/           创建新 session 或向已有 session 转发消息
      index.ts            dispatchMiddleware 实现
      prompt/             会话启动时 systemPrompt 组装
        agent-rules.ts      读取 `.ai/rules/AGENTS.channel.<type>.md` 规则文件
        context.ts          生成频道上下文（平台名、bot 名称、admin 列表）
        index.ts            buildSessionSystemPrompt（汇总所有 prompt 片段）
```

## middleware/ 文件组织规则

`middleware/` 目录下只存在三类文件：

1. **`@` 开头的目录**（如 `@types/`、`@utils/`）— 放置通用工具与类型定义，不含业务逻辑；
   目录内以 `index.ts` 作为唯一出口。

2. **中间件实现文件**（如 `ack.ts`、`commands.ts`）— 每个文件只导出一个 `ChannelMiddleware`，
   命名统一为 `<camelCase>Middleware`。

3. **`index.ts`**（唯一入口）— 负责管道组装（`compose`）、`pipeline` 导出；
   不包含 `ChannelContext` 组装逻辑（ctx 在 `handlers.ts` 中创建）。

## 中间件管道执行顺序

```
deduplicateMiddleware      → 重复消息截断
parseContentMiddleware     → 空消息截断，解析 contentItems，计算 commandText
accessControlMiddleware    → 权限不符截断（admins 豁免所有控制）
resolveSessionMiddleware   → 填充 ctx.sessionId
channelCommandMiddleware   → 识别到指令处理并截断，否则 next()
ackMiddleware              → 发送处理中状态
adminGateMiddleware        → 无 session 且非 admin 截断并提示
dispatchMiddleware         → 创建 session 或转发消息到已有 session
bindSessionMiddleware      → 持久化 channel↔session 绑定
```

## Channel 配置字段

`channelBaseSchema`（`@vibe-forge/core/channel`）支持以下字段：

| 字段                      | 类型        | 说明                                                    |
| ------------------------- | ----------- | ------------------------------------------------------- |
| `type`                    | `string`    | 频道类型（必填）                                        |
| `title`                   | `string?`   | 频道标题，也作为 bot 在该频道的显示名称                 |
| `description`             | `string?`   | 频道说明                                                |
| `enabled`                 | `boolean?`  | 是否启用，默认 true                                     |
| `systemPrompt`            | `string?`   | 启动会话时注入的系统提示词                              |
| `commandPrefix`           | `string?`   | 频道指令前缀，默认 `/`                                  |
| `language`                | `zh\|en?`   | 频道提示语言，默认 `zh`                                 |
| `enableSessionMcp`        | `boolean?`  | 是否自动挂载该频道提供的 session companion MCP，默认 true |
| `access.admins`           | `string[]?` | 管理员 sender ID 列表，豁免所有访问控制，可执行管理指令 |
| `access.allowPrivateChat` | `boolean?`  | 是否接受私聊，默认 true                                 |
| `access.allowGroupChat`   | `boolean?`  | 是否接受群聊，默认 true                                 |
| `access.allowedGroups`    | `string[]?` | 群组白名单（channel ID）                                |
| `access.blockedGroups`    | `string[]?` | 群组黑名单（channel ID）                                |
| `access.allowedSenders`   | `string[]?` | 发送者白名单（sender ID）                               |
| `access.blockedSenders`   | `string[]?` | 发送者黑名单（sender ID），优先于白名单                 |

## Companion MCP 约定

Channel 包可以可选导出 `@vibe-forge/channel-<type>/mcp` 子入口，用于声明该频道的 session-scoped companion MCP。

- 子入口导出 `resolveChannelSessionMcpServers(config, context)`。
- 返回值是具体 MCP server 配置数组；server 会在会话启动时解析，而不是在 workspace 资产阶段预注入。
- companion MCP 只会注入到“从该频道绑定会话启动出来的 adapter session”里，不会影响其他会话。
- `enableSessionMcp !== false` 时默认启用；频道配置可按 channel key 单独关闭。
- companion MCP 应优先暴露该频道上下文相关、需要当前会话绑定信息才能安全执行的动作，例如发送消息、查询当前群、处理频道目录对象等。
- 命名推荐使用 `channel-<type>-<channelKey>` 前缀，避免和用户 workspace 自带的 MCP 重名。

实现约定：

```typescript
export const resolveChannelSessionMcpServers =
  defineResolveChannelSessionMcpServers<MyChannelConfig>((config, context) => [
    {
      name: `channel-mytype-${context.channelKey}`,
      config: {
        command: process.execPath,
        args: [resolveMcpCliPath()],
        env: {
          VF_CHANNEL_SESSION_ID: context.sessionId,
          VF_CHANNEL_KEY: context.channelKey
        }
      }
    }
  ])
```

## systemPrompt 组装顺序

新建 session 时，以下片段按顺序 `\n\n` 拼接：

1. `config.systemPrompt` — 配置文件中直接写的提示词
2. `buildChannelContextPrompt()` — 自动生成（平台名 / bot 名 / admin 列表）
3. `loadChannelAgentRules()` — 优先读取 `.ai/rules/AGENTS.channel.<channelType>.md`，兼容回退到项目根目录同名文件
4. `connection.generateSystemPrompt()` — 频道连接实现动态生成（如调平台 API）

最终再与 `startAdapterSession` 内部的 spec/entity prompt 和语言提示合并。

## ChannelConnection 接口扩展

`@vibe-forge/core/channel` 的 `ChannelConnection<TMessage>` 支持可选方法：

```typescript
import type { ChannelInboundEvent } from '@vibe-forge/core/channel'

interface ChannelConnectionExtensions {
  updateMessage?: (
    messageId: string,
    message: TMessage
  ) => Promise<ChannelSendResult | undefined>
  generateSystemPrompt?: (
    inbound: ChannelInboundEvent
  ) => Promise<string | undefined>
}
```

频道实现可在此方法中调用平台 API（如获取 bot profile），结果自动注入 systemPrompt。

`updateMessage` 主要用于频道内的增量状态展示，例如把连续的 tool_use / tool_result 事件更新到同一条卡片或消息里，而不是每次发送一条新的文本回复。

## 工作约定

- `channels/index.ts` 仅负责初始化与对外导出，不新增业务逻辑
- `handlers.ts` 只保留出站事件处理（`handleSessionEvent`），入站逻辑全部在管道中
- `state.ts` 只管理内存状态，不写 DB
- `loader.ts` 只负责动态加载频道连接模块
- 新增中间件在 `middleware/` 下单独建文件，导出格式为 `export const <name>Middleware: ChannelMiddleware`，在 `middleware/index.ts` 中按顺序组装
- 新增 prompt 片段在 `middleware/dispatch/prompt/` 下单独建文件，在 `middleware/dispatch/prompt/index.ts` 中汇总
- `middleware/` 下的公共类型统一放在 `middleware/@types/`，不直接写在实现文件中
- 任何对 `channel_sessions` 的写入必须同时更新内存绑定（`bindSessionMiddleware` 统一处理）
- 删除会话时要同步清理 `channel_sessions` 和内存 binding
