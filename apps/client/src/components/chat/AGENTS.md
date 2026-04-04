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
  - 默认 sender 和 inline edit 共用的 composer。
  - 文本输入、图片上传、工具/模型/权限模式选择都在这里。
- `sender/Sender.scss`
  - sender 和 inline edit 的共同样式来源。

## 消息级操作的当前约束

- assistant 消息不允许 fork；前端不显示按钮，后端也会拒绝。
- inline edit 必须复用 `Sender`，不要另造一套 textarea/composer。
- 编辑期间底部主 sender 必须隐藏，避免出现双输入源。
- 同一时间只允许一条消息进入编辑态；冲突时保留当前编辑器并提示用户。
- `复制原文` 复制的是原始 markdown/text，不是渲染后的可见 DOM 文本。
- 编辑确认按钮固定使用 `发送`，不要改回实现导向文案。

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
