# 消息级操作开发经验

本文沉淀消息级 `编辑 / 撤回 / 分叉 / 复制原文` 相关开发的高频结论，便于后续继续演进时快速对齐约束、回归点与常见坑位。

## 功能边界

- `fork` 只允许用户消息；不要只在前端隐藏按钮，后端也必须拒绝 assistant message 的分叉请求。
- `edit` 目前语义不是“原会话就地改写”，而是“基于选中消息创建新分支会话并继续回复”。
- `recall` 也走分支会话，而不是直接截断原会话历史。
- `copy` 复制的是原始文本/markdown，不是渲染后的 DOM 文本。

## 关键实现约束

### 1. 分支会话必须保留完整历史种子

- `historySeed` 不能只保留纯文本；如果被裁切区间内有工具调用，还要保留 `tool_use` / `tool_result` / 旧版 `message.toolCall` 的上下文。
- 否则新分支会话虽然能创建，但 adapter 看到的是缺失工具背景的历史，后续回复容易失真。

### 2. 基于历史种子的分支会话必须走 `create`，不能走 `resume`

- 只要会话依赖 `historySeedPending` 回放历史，就应该启动全新的 adapter runtime。
- 如果错误复用成 `resume`，runtime 会带上旧上下文，导致“看起来是新会话，实际继续了旧运行态”的混合状态。

### 3. 编辑态必须复用 sender，而不是单独维护一套 textarea

- Inline edit 应直接复用底部 sender 的 composer 结构，保证图片上传、资源类型扩展和后续交互一致。
- 同时只能允许一条消息进入编辑态；编辑中的消息 id 必须上提到列表父层统一管理。
- 正在编辑时要隐藏底部主 sender，避免出现“历史编辑 + 新消息发送”并行输入。

### 4. 联合类型必须显式收窄到可编辑内容

- `ChatMessageContent[]` 包含 `text / image / tool_use / tool_result`。
- 编辑链路只接受 `text / image`，否则前端在 `url / name / size / mimeType` 上会出现类型错误，CI `typecheck` 会失败。
- 推荐做法是单独声明 `EditableMessageItem`，再用类型守卫收窄。

### 5. i18n 与按钮语义要一起收口

- 消息 footer 的文案不能继续写死在组件里，应同步维护中英文 locale。
- 编辑确认按钮语义固定为 `发送`，不要混入“保存并分叉”这类实现导向文案。

## 本次开发里真实踩过的坑

### 1. 本地通过但 PR `typecheck` 失败

- 原因通常不是 CI 特殊，而是本地只跑了局部命令，没有覆盖到 `bundler.web` 的完整类型路径。
- 处理方式：优先用 `pnpm typecheck`，不要只跑 `pnpm -r exec tsc --noEmit` 替代。

### 2. PR `format-check` 失败

- `dprint` 对 JSX 缩进和 import 排序比肉眼更严格。
- 提交前直接跑 `pnpm exec dprint check`；如果失败，用 `pnpm exec dprint fmt <files...>` 修，不要手工对格式。

### 3. `commit-message` 失败不一定是 commit title 本身有问题

- 这次的实际问题是 workflow 里 `actions/setup-node` 在 `pnpm/action-setup` 之前执行，`cache: pnpm` 找不到可执行文件。
- 看到 `Unable to locate executable file: pnpm` 时，先检查 CI workflow 顺序，不要误判成 commit range 计算错误。

### 4. 临时浏览器脚本会被界面文案变更击穿

- 之前的临时 Playwright 脚本依赖按钮名 `保存并分叉`，改成 `发送` 后脚本直接卡死。
- 浏览器验证脚本如果继续维护，优先绑定稳定语义（`aria-label` / 结构断言），不要强依赖易变文案。

### 5. 分支会话带权限审批时，先造稳定数据，再补真实链路 smoke

- `edit / recall / fork` 产生的分支会话，如果一上来就要做权限审批，浏览器验收不要每次都强依赖真实 adapter 跑到 `waiting_input`。
- 更稳的做法是先造一份稳定的分支会话数据，把父会话来源、子会话 `waiting_input` 状态、`interaction_request`、以及批准/拒绝/超时后的状态切换准备好，再专门验 UI 渲染、按钮反馈、消息补拉和列表状态。
- 这样可以把“交互是否好用”与“adapter 是否刚好走到这条权限分支”拆开，避免因为外部权限模式、模型分支或 hook 波动导致前端验收反复失真。
- 真实浏览器链路仍然要保留一条 smoke，只用来确认真实 adapter 最终能进入同类审批状态；不要让每次样式或文案微调都绑定 live 权限运行。
- 造数据时至少保留这些关键信息：父消息来源、分支会话 id 与状态、审批标题/原因/工具名、可选项集合，以及批准后继续执行或超时失败的后置状态。

## 推荐回归清单

- 用户消息 hover 后能看到 `编辑 / 撤回 / 复制原文`，assistant 消息没有 `fork`。
- 编辑态替换原消息气泡，原 markdown 不再同时渲染。
- 同时只允许一条消息编辑；第二次尝试会提示已有编辑中的消息。
- 编辑时底部 sender 隐藏，取消后恢复。
- `copy` 拿到的是 markdown 原文。
- `edit / recall / fork` 后新分支会话会继续触发一轮新的 assistant 回复。
- 分支历史如果包含工具调用，生成的新会话仍能看到完整上下文。
