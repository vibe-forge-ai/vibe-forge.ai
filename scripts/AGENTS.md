# Scripts 目录说明

`scripts/` 下的维护命令统一收口到一个 TS CLI：

- loader: `scripts/run-tools.mjs`
- commander 入口: `scripts/cli.ts`

不要再往 `package.json` 新增一串独立脚本名。新增维护命令时，优先给 `scripts/cli.ts` 增加子命令，再在文档里写 `pnpm tools ...` 的调用方式。

## 当前命令

- `pnpm tools adapter-e2e run <selection>`
  - 真实离线 adapter E2E。`selection` 支持 `codex` / `claude-code` / `opencode` / case id / `all`
- `pnpm tools adapter-e2e test [selection]`
  - 跑 `scripts/__tests__/adapter-e2e/adapter-e2e.spec.ts`
- `pnpm tools adapter-e2e test [selection] --update`
  - 更新对应 case 的 file snapshot
- `pnpm tools chrome-debug targets [--port 9222]`
  - 查看本机 Chrome DevTools 目标页，确认当前 remote debugging 端口上有哪些页面
- `pnpm tools chrome-debug messenger-conversations`
  - 列出当前 Feishu messenger 页里左侧可见的会话候选；如果用户没有明确指定目标会话，先跑这个命令再向用户确认
- `pnpm tools chrome-debug messenger-send <conversation> <message>`
  - 在当前 Feishu messenger 页里按会话名点开会话并发送一条消息
  - 如果是本轮第一次往该页面发消息，先确认目标会话；用户只说“我打开了一个会话”时，不要直接发送
- `pnpm tools chrome-debug messenger-click-reply <conversation> <messageSnippet>`
  - 在当前 Feishu messenger 页里悬停某条消息，并点击它的 reply 按钮
- `pnpm tools chrome-debug messenger-click-text <conversation> <text>`
  - 在当前 Feishu messenger 页里按可见文本点击一个右侧会话内的按钮或快捷气泡
- `pnpm tools message-actions verify [--quiet]`
  - 跑消息级 `编辑 / 撤回 / 分叉 / 复制原文` 的固定质量检查组合，并打印真实 Chrome 回归清单
- `pnpm tools commitmsg-check [base] [head]`
  - 校验一个 git range 里的 commit title 是否符合 Conventional Commit；GitHub 默认 merge commit 例外
- `pnpm tools publish-plan -- [args]`
  - 透传到 `scripts/publish-plan-core.mjs`
  - 发布规则、检查清单和 tag 约定统一见 `.ai/rules/RELEASE.md`

## publish-plan 使用备注

- `publish-plan` 只负责基于显式包选择和内部依赖生成发布顺序。
- 所有“是否该发布、怎么发布、发布后怎么收尾”的规则统一见 `.ai/rules/RELEASE.md`。

## adapter-e2e 结构

- `scripts/adapter-e2e/harness.ts`
  - suite 生命周期
- `scripts/chrome-debug.ts`
  - Chrome DevTools 本地调试 helper，负责枚举目标页、连接 CDP 和执行 messenger 发送动作
- `scripts/adapter-e2e/runners.ts`
  - Codex / Claude / OpenCode 的真实运行路径
- `scripts/adapter-e2e/log.ts`
  - hook 日志解析与事件计数
- `scripts/adapter-e2e/snapshot.ts`
  - 真实 CLI 结果 -> 稳定 snapshot projection
- `scripts/adapter-e2e/mock-llm/request.ts`
  - 请求体解析与 input 摘要提取
- `scripts/adapter-e2e/mock-llm/tooling.ts`
  - mock tool 选择与入参生成
- `scripts/adapter-e2e/mock-llm/rules.ts`
  - `when...` / `messageTurn` / `selectedToolTurn` 这套规则 DSL
- `scripts/adapter-e2e/mock-llm/registry.ts`
  - scenario registry 与 turn 解析
- `scripts/adapter-e2e/mock-llm/responses.ts`
  - OpenAI Responses mock 输出
- `scripts/adapter-e2e/mock-llm/chat-completions.ts`
  - Chat Completions mock 输出
- `scripts/adapter-e2e/mock-llm/server.ts`
  - mock server 装配
- `scripts/__tests__/adapter-e2e/cases.ts`
  - case DSL、case 选择、标准场景族、显式 expectations
- `scripts/__tests__/adapter-e2e/assertions.ts`
  - 结构化 expectations 校验 + Vitest file snapshot 入口
- `scripts/__tests__/adapter-e2e/adapter-e2e.spec.ts`
  - 真实 CLI E2E spec
- `scripts/__tests__/adapter-e2e/log.spec.ts`
  - hook 日志 parser 和 snapshot projection 单测
- `scripts/__tests__/adapter-e2e/mock-llm.spec.ts`
  - mock LLM 规则 DSL 单测

## Lark 调试约定

- 用户没有明确给出会话名时，第一次发消息前先把当前会话标题或可见候选回给用户确认。
- 用户确认过本轮调试目标后，后续默认继续复用同一会话，除非用户明确要求切换。

## 维护约定

- 入口层只做命令解析和调度，不写业务逻辑。
- adapter E2E 的 case 定义、Vitest spec、mock-llm 单测、snapshot 必须放在 `scripts/__tests__/adapter-e2e/` 一处维护。
- adapter E2E 新增场景时，先在 `scripts/__tests__/adapter-e2e/cases.ts` 定义 case 的 `prompt/model/mockScenarios/expectations`，再用 `mock-llm/rules.ts` 组合 mock 行为。
- 先写结构化 expectations，再看 snapshot。最低限度要覆盖输出文本、mock trace、hook 事件计数；file snapshot 负责保留完整回归上下文。
- 当前标准场景至少保持两类：`*-read-once` 验证工具链路，`*-direct-answer` 验证无工具直答链路。
- mock server 要记录“请求摘要 -> mock 响应摘要”，让 snapshot 能直接表达 mock LLM 输入输出链路。
- hook 日志解析不要再堆复杂正则，优先维护在 `scripts/adapter-e2e/log.ts` 的 line-based parser。
- mock server 的协议输出和请求解析必须分文件维护，不要再回到单个大脚本。
- 优先让测试直接 import TS 模块，不要绕兼容 wrapper。
