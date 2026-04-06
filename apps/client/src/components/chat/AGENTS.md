# Chat 组件维护说明

本目录承载聊天页内部视图。涉及消息级交互时，优先从这里读起，而不是只看顶层 route。

## 关键文件职责

- `ChatHistoryView.tsx`
  - 会话消息列表的父层编排。
  - 管理 `editingMessageId`。
  - 负责“已有一条消息正在编辑”的冲突提示。
  - 负责编辑期间隐藏底部主 sender。
- `messages/MessageItem.tsx`
  - 单条消息渲染。
  - 消息 footer 操作按钮。
  - inline edit 的消息内挂载点。
  - 原始文本复制逻辑。
- `messages/MessageFooter.tsx`
  - 消息 footer 的统一承载层。
  - 改 footer 文案或按钮时，优先改这里，不要散落到 `MessageItem`。
- `sender/Sender.tsx`
  - 默认 sender 和 inline edit 共用的最外层装配入口。
  - 只保留 sender 壳层、局部视图拼装和少量同目录引用，不再承载大段状态编排。
- `sender/Sender.scss`
  - sender 和 inline edit 的共同样式来源。
- `sender/@components/`
  - sender 私有的通用视图组件与子模块目录，例如 `sender-toolbar/`、`model-select/`。
- `sender/@core/`
  - sender 私有的编排与纯逻辑，例如 toolbar bindings、content 组装、interaction 判断。
- `sender/@hooks/`
  - sender 私有的状态编排、快捷键、focus restore、overlay 控制、提交逻辑等 hooks。
- `sender/@types/`
  - sender 私有类型定义。
- `sender/@utils/`
  - sender 私有常量与轻量工具函数。
- `ThinkingStatus.tsx`
  - 聊天域可复用的状态提示组件，不再算 sender 私有视图。
- `../../components/workspace/ContextFilePicker.tsx`
  - 工作区文件选择器；如果别的输入入口也要复用目录树选择，直接走这里。

## 消息级操作的当前约束

- assistant 消息不允许 fork；前端不显示按钮，后端也会拒绝。
- inline edit 必须复用 `Sender`，不要另造一套 textarea/composer。
- 编辑期间底部主 sender 必须隐藏，避免出现双输入源。
- 同一时间只允许一条消息进入编辑态；冲突时保留当前编辑器并提示用户。
- `复制原文` 复制的是原始 markdown/text，不是渲染后的可见 DOM 文本。
- 编辑确认按钮固定使用 `发送`，不要改回实现导向文案。
- 用户消息的 hover 操作按钮固定挂在消息左侧的独立 action rail，不要再塞回 footer 里挤占阅读流。
- assistant 消息的可见 footer 操作按钮只保留最后一条；更早的 assistant / tool 消息只能通过右键菜单触发操作。
- 消息级右键菜单必须同时兼容普通消息和工具调用块；`复制消息链接` 走 `#message-*` hash 锚点，落点要能直接滚动到对应消息位置，而不只是会话页。
- 消息级操作要始终基于原始 message id，而不是渲染拆分后的临时 id；`text/tool-group` 拆分只影响展示，不应影响 `edit / recall / fork / copy id / copy link`。

## Sender 结构约束

- sender 只是当前已按“前端模块通用组织规范”落地的一个示例，不是特殊规则来源。
- 通用规则入口：`../../../../.ai/rules/frontend-standard/module-organization.md`
- sender 目录不要长期平铺文件；模块根只保留入口和极少量顶层样式。
- sender 私有实现按 `@components / @core / @hooks / @types / @utils / @store` 分层。
- sender 的状态型 hooks 放在 `sender/@hooks/`，不要再回塞到 `Sender.tsx` 或平铺在模块根目录。
- sender 的纯逻辑和装配放在 `sender/@core/`，不要混进视图组件。
- sender 的类型定义统一放在 `sender/@types/`，不要散在 core 和 component 里。
- sender 中如果出现可跨页面或跨模块复用的组件，应提升到更公共的 `src/components/...` 目录，不继续留在 `sender/` 私有目录。
- sender 相关单文件应尽量收敛在 200 行以内；超过后优先拆视图子组件、hooks、utils、样式文件，而不是继续在原文件加条件分支。
- 子模块如果已经独立成形，例如 `model-select`、`reference-actions`、`sender-toolbar`，应建子目录，并在子目录内继续按职责拆分，而不是把新的辅助文件继续堆回 sender 根目录。

## Sender import 约定

- `Sender` 及其子组件按固定顺序组织 import：
  1. 本文件样式
  2. 第三方依赖
  3. workspace 包
  4. `#~/` 绝对路径
  5. 当前目录相对路径
- 每个 group 之间保留一个空行。
- sender 目录内部，同子模块兄弟文件继续使用相对路径。
- sender 入口或跨子模块引用模块私有实现时，优先显式指向 `@components / @core / @hooks / @types / @utils / @store`，避免重新打平目录边界。

## 改动时容易漏掉的地方

### 1. i18n

- 新增或调整消息操作文案时，同时更新：
  - `src/resources/locales/zh.json`
  - `src/resources/locales/en.json`

### 2. 可编辑内容类型

- `Sender` 支持 `ChatMessageContent[]`，但 inline edit 只应该接受 `text / image`。
- 如果在 `MessageItem` 里直接把 `ChatMessageContent[]` 当成可编辑内容使用，`typecheck` 很容易在 `tool_use / tool_result` 分支上失败。

### 3. 真实界面验证

- 这块交互非常依赖真实布局、hover 和按钮语义。
- 只跑单测或后端测试不够；改完必须用真实 Chrome 回归。

### 4. 临时脚本脆弱性

- 浏览器验证不要强依赖易变按钮文案。
- 更稳妥的是依赖 `aria-label`、稳定类名或结构断言。

## Sender / 浮层调试经验

- `ChatHeader` 需要同时保留显式和隐藏两条调试入口：
  - 右上角 `更多` 左边的 debug 状态按钮默认隐藏，只有当前 URL 已经带 `debug` query 时才显示；显示后点击按钮切换 URL 上的 `debug` query。
  - debug 状态切换只在 `debug=true / debug=false` 之间切，不要通过按钮把 `debug` query 直接删掉。
  - 标题支持隐藏调试入口：连续点击标题 5 次时，同样切换 URL 上的 `debug` 状态；不能只留在 console 里。
- 只要 URL 上存在 `debug` query，就视为 debug 模式：
  - `debug=true` 才算真正开启调试模式；`debug=false` 只保留入口，不展示调试内容。
  - 调试元信息展示在 `settings` 视图，不再展示在标题下面。
  - 消息时间戳只在 `debug=true` 时展示。
  - 后续如果继续精简 header 或 settings，也要保留这条 query 驱动的可见调试通路。
- `Sender.tsx` 同时组合了 `Tooltip`、`Popover`、`Select` 和自定义 trigger；一旦外层包装组件不透传 `ref` 或 DOM props，触发器很容易直接失效。
- 包装触发器时不要用无效 DOM 结构，例如 `span` 包 `div`；这类 nesting warning 往往伴随点击异常。
- 同一个控件如果既有 tooltip 又有 popup，popup 打开时要显式禁用 tooltip；否则 hover 层会抢事件或扰乱 focus。
- 自定义 select 箭头后，必须分别验证：
  - 文本区能打开
  - 箭头区能打开
  - 关闭后 focus 回输入框
- sender 的颜色改动要谨慎收窄 selector，避免把下面这些一起误伤：
  - 最高推理强度图标
  - 权限菜单勾选图标
  - 发送按钮
  - disabled / hover / selected 态
- 通用 tooltip 的字号、min-height 这类全局表面样式，优先改 `src/styles/global.scss` 或主题配置，不要只在 sender 局部覆盖。
- 调 tooltip / popover / 主题样式后，先 reload 页面，再看 computed style 和 console warning；隐藏浮层节点和旧 bundle warning 很容易导致误判。

## Sender 最小回归清单

1. `更多` 主菜单能打开，权限二级菜单能展开。
2. 模型和推理强度的文本区、箭头区都能打开。
3. popup 打开时不会叠出自己的 tooltip。
4. popup 关闭后输入框重新获得 focus。
5. reload 后没有 React DOM nesting warning，也没有 Ant deprecation warning。
6. 同时检查浅色 / 深色主题下的 tooltip、勾选图标、推理强度图标和发送按钮。

## 推荐调试顺序

1. 先看 `ChatHistoryView.tsx`，确认父层状态是不是放对了。
2. 再看 `MessageItem.tsx`，确认消息级入口和 sender 挂载点。
3. 如涉及输入能力，再看 `Sender.tsx`。
4. 如涉及消息操作请求，再看 `src/hooks/chat/use-chat-session-actions.ts` 和 `src/api/sessions.ts`。
5. 最后回到真实 Chrome 做界面验证。

## 推荐回归命令

```bash
pnpm tools message-actions verify
```

如果需要只看最终结果，不看中间子命令输出：

```bash
pnpm tools message-actions verify --quiet
```

进一步的经验和工具说明见：

- `../../../../../.ai/rules/maintenance/message-actions.md`
- `../../../../../.ai/rules/maintenance/tooling.md`
