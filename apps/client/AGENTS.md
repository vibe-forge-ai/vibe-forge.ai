# Client 目录说明

- `src/App.tsx`：客户端根入口，负责挂载主题、全局订阅、侧边栏导航和应用壳。
- `src/routes/`：页面级 route 入口，只处理 URL、路由参数、页面装配和少量 route 级数据获取。
- `src/components/layout/`：全局布局组件，当前放置 `AppShell` 这类应用骨架。
- `src/components/`：可复用视图组件和页面内部面板，不承担路由匹配职责。
- `src/components/config/`：配置页编辑器、worktree environment 面板与配置冲突处理逻辑。
  - 涉及配置页自动保存、热更新、外部配置变更或冲突提示时，先读 `src/components/config/AGENTS.md`。
- `src/components/chat/`：聊天页子视图，包含 header、history、timeline、settings、sender 和工具渲染。
  - 消息级 `编辑 / 撤回 / 分叉 / 复制原文` 的更细维护说明见 `src/components/chat/AGENTS.md`。
- `src/hooks/`：跨页面通用 hooks；`src/hooks/chat/` 专门承载聊天会话相关状态和交互逻辑。
- `src/api/`：HTTP API 封装与响应类型，页面和 hooks 统一通过这里访问后端。
- `src/store/`：全局状态原子。
- `src/resources/`：静态资源、适配器元数据和 i18n 文案。
- `src/styles/`：全局样式入口。

## 约定

路由分层：

- 新增页面入口时，优先放在 `src/routes/`。
- route 组件可以读取 `useParams`、`useNavigate`、query params，并做页面级数据装配。
- 纯展示或可复用 UI 不要放在 `src/routes/`，应放回 `src/components/`。

布局分层：

- 全局布局和页面外壳统一放在 `src/components/layout/`。
- 不要再创建 `components/app/routes` 这类把布局和路由混放的目录。

聊天页约定：

- 聊天页面入口统一由 route 组件承接，当前为 `src/routes/ChatRoute.tsx`。
- `ChatRoute` 负责 `/` 与 `/session/:sessionId` 的合并入口、会话解析和空态处理。
- `src/components/chat/` 只保留聊天页面内部视图，不再单独维护旧式 route wrapper。
- 会话列表的“搜索 / 筛选 / 排序 / 收起态”已写入 URL query；后续新增 session 级 UI 状态时，优先先判断是否也应落到 query，而不是只放组件本地 state。
- 会话卡片支持右键上下文菜单；涉及 `收藏 / 重命名 / 归档 / 复制链接 / 复制 ID / 复制控制台指令` 时，优先沿着右键菜单扩展，不要再把所有能力塞回 hover 按钮。

数据流约定：

- 页面级列表或详情拉取优先放在 route 或对应页面 hook 中，不要散落在纯展示组件内。
- API 请求统一走 `src/api/`，避免在组件里直接手写 `fetch`。
- 能复用的状态逻辑优先抽到 hooks，不在 route 和 view 间复制业务逻辑。
- 配置页收到 `config_updated` 后，订阅层只负责刷新缓存；本地草稿和远端配置的冲突判断必须留在配置编辑器内部完成，避免静默覆盖用户正在编辑的内容。

组件与 hook 归档约定：

- 前端业务模块统一遵循 `../../.ai/rules/frontend-standard/module-organization.md`，这不是 sender 私有约定。
- 模块目录不要长期平铺文件；优先拆成 `@components / @core / @hooks / @types / @utils / @store`。
- 模块私有 hooks、utils、types、store 放在模块自己的 `@*` 目录中，不和全局 `src/hooks`、`src/utils`、`src/store` 混用。
- 只有跨模块复用的 hooks、components、utils、store，才提升到 `src/hooks/`、`src/components/`、`src/utils/`、`src/store/`。
- 如果一个组件明显可被其他页面/模块复用，应放到更公共的 `src/components/` 子目录，而不是继续留在某个页面私有目录。
- 当前例子：
  - sender 私有编排逻辑在 `src/components/chat/sender/@hooks/`
  - sender 私有核心逻辑在 `src/components/chat/sender/@core/`
  - 聊天共用状态提示在 `src/components/chat/`
  - 工作区文件选择器和可复用项目目录树在 `src/components/workspace/`

import 约定：

- 遵循 `.ai/rules/CODING-STYLE.md` 的 group 顺序，并在 group 之间保留一个空行。
- `#~/` 用于 client 包内跨目录引用；不要在组件里持续叠加 `../../`。
- 模块入口引用自己的 `@components / @core / @hooks / @types / @utils` 时，可以使用模块内相对路径。
- 子模块内部如果只是引用同子模块兄弟文件，继续用相对路径；跨到别的子模块或更上层职责目录时，优先保证路径语义清晰，不要为了省几层目录把结构打平。

前端调试入口：

- 如果任务涉及 tooltip / popover / select / theme / sender / focus / hover / 样式回归 / 真实 Chrome 验证 / CDP 调试，开始修改前必须先读 `../../.ai/rules/frontend-standard/debugging.md`。
- 需要通过 Chrome DevTools Protocol 调试页面时，必须使用独立 profile 和冷启动的调试 Chrome，不要直接复用用户已经打开的日常浏览器实例。
- 样式和交互问题不要只看代码；至少做一次真实 Chrome 的 computed style、open state 和 focus 回归。

## 聊天消息操作维护

如果任务涉及聊天消息级交互，优先读这些入口：

- `src/components/chat/ChatHistoryView.tsx`
  - 列表级状态，包含 `editingMessageId`、编辑冲突提示、编辑期间隐藏底部 sender。
- `src/components/chat/messages/MessageItem.tsx`
  - 单条消息的 `编辑 / 撤回 / 分叉 / 复制原文` UI，以及 inline edit 挂载点。
- `src/components/chat/sender/Sender.tsx`
  - 底部 sender 和 inline edit 共用的 composer；图片上传和资源型输入都从这里走。
- 如果涉及 sender / 浮层组合，还要同步看 `src/components/chat/AGENTS.md` 里的 sender 调试经验。
- `src/hooks/chat/use-chat-session-actions.ts`
  - 消息操作的前端 action 入口。
- `src/api/sessions.ts`
  - 会话/消息分支相关 API 封装。

进一步经验与工具说明：

- 经验沉淀：`../../.ai/rules/maintenance/message-actions.md`
- 工具与使用法：`../../.ai/rules/maintenance/tooling.md`

## 消息级调试与回归

推荐先跑：

```bash
pnpm tools message-actions verify
```

这个命令会串行执行：

- `eslint`
- `dprint check`
- `pnpm typecheck`
- 消息级操作相关回归测试
- 真实 Chrome 手工验证清单输出

真实 Chrome 最低回归项：

1. 编辑态替换原消息，不允许“原消息 + 编辑器”并存。
2. 编辑确认按钮文案是 `发送`。
3. 同时只能编辑一条消息；再次点编辑会提示已有编辑中的消息。
4. 编辑时底部 sender 隐藏，取消后恢复。
5. assistant 消息不允许 fork，`复制原文` 复制的是原始 markdown/text。
6. `edit / recall / fork` 后新分支会继续触发 assistant 回复。
