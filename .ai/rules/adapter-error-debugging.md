# 适配器错误调试经验

这份文档不记录某次修了什么，而是总结一套可重复使用的调试经验。目标只有两个：

- 判断错误到底坏在 CLI、adapter，还是上游模型/代理
- 用最小代价复现，并验证 `stream-json` 事件和进程退出语义

## 1. 先分层，不要一上来就看实现

调试适配器错误时，先把问题分成三层：

### 1. 上游行为层

问题特征：

- provider 直接返回 4xx/5xx
- SSE 提前断流
- 返回的是 `incomplete`，但不一定被上游当成 fatal
- 请求根本没发出去

这一层先回答：

- 请求有没有真的到 mock host
- 到了以后，返回的错误形态是不是你想验证的那一种

### 2. adapter 归一化层

问题特征：

- 上游已经报错，但 adapter 没发标准 `error`
- 不同 adapter 对同一类错误的归一化不一致
- 错误细节被吞掉，只剩一行 message

这一层先回答：

- adapter 有没有把上游错误转成标准 `error` event
- `details` 里有没有保住足够的上下文

### 3. CLI 表达层

问题特征：

- `stream-json` 里明明有 fatal error，但 shell 返回码还是 `0`
- `text` / `json` / `stream-json` 三种输出模式行为不一致
- 外层 loader 进程吞掉了子进程退出码

这一层先回答：

- 打印出来的事件是否符合预期
- 外层 `npx vf` 的退出码是否非 `0`

经验：很多“adapter 错误”最终并不是 adapter 的问题，而是请求没出发、外层 CLI 没透传退出码，或者上游根本没把某类返回视为失败。

## 2. 造错要选“代表性场景”，不要只造最容易写的场景

最值得保留的场景不是“能报错”就行，而是要尽量贴近真实线上问题。

### `mock-bad-request`

用途：

- 验证 provider 4xx 是否能变成标准 `error`
- 验证 `details` 是否保住原始错误体

适合发现：

- adapter 漏发 `error`
- `claude-code` 这类“看起来是 success，但 `is_error=true`”的边缘情况

### `mock-malformed-stream`

用途：

- 验证真实流断开、SSE 格式损坏、`response.completed` 缺失

适合发现：

- `codex` 的重试和最终 fatal error 路径
- 最接近 “stream disconnected before completion” 这类线上问题

### `mock-incomplete-max-output`

用途：

- 验证上游返回 `incomplete` 时，各 adapter 如何处理

适合发现：

- 某些“看起来像错误，但上游并不认为 fatal”的情况

经验：这个场景经常不能直接逼出 fatal error，所以它不适合作为第一优先场景。要测“断流导致失败”，优先用 `mock-malformed-stream`；要测“provider 报错被 adapter 吃掉”，优先用 `mock-bad-request`。

## 3. 真正要验证的是两个契约，不是一个

### 契约 A：事件契约

至少看三件事：

- `stdout` 里有没有标准 `error` event
- `error.data.message` 是否足够可读
- `error.data.details` 是否保住原始上下文

如果这里不对，问题通常在 adapter 归一化层。

### 契约 B：进程契约

fatal error 不只是“打印出来”，还必须保证：

- `npx vf --print ...` 返回非 `0`
- 外层 loader 不吞掉子进程退出码

如果事件对了、退出码错了，优先检查：

- `apps/cli/src/commands/run.ts`
- `packages/cli-helper/loader.js`

经验：这两个契约必须分开验证。只看 `stream-json` 的输出，很容易误判为“修好了”。

## 4. 如何判断问题不在 adapter

下面这些现象，通常说明不要继续在 adapter parser 里深挖：

### mock host 完全没收到请求

更可能是：

- model service 没接上
- CLI/provider 配置没被真正消费
- 上游 CLI 卡在发请求之前

这类问题优先看：

- 临时 model service 是否真的生效
- 子进程环境变量里有没有正确的 provider 配置
- 上游 CLI 自己的日志或进程状态

### 子进程拿到了配置，但一直空转

更可能是：

- 上游 CLI 本身挂住
- 卡在 session / project / MCP 初始化

经验：这类情况不要先改 adapter 的 `error` 映射，因为 adapter 根本还没收到可映射的错误。

## 5. 不同 adapter 的经验差异

### Codex

- 最像线上真实问题的是流损坏和断流，不是普通 400
- `mock-malformed-stream` 比 `mock-incomplete-max-output` 更有调试价值
- 观察点除了 `error` event，还要看 stderr 里的 retry 日志

### Claude Code

- 不能只盯 `error_during_execution`
- 真实 provider 错误可能以 `result.success + is_error=true` 的形式出现
- 如果 `stream-json` 里只有 `message` 和 `stop`，通常说明 parser 漏掉了 error 分支

### OpenCode

- 先确认请求有没有到 host
- 如果 provider 配置已经注入，但 host 没请求，优先怀疑上游 CLI
- 不要在 adapter 映射层浪费时间猜测一个还没发生的错误

## 6. 配置与环境的经验

- mock model service 应该临时加到 `.ai.config.json`，跑完恢复
- 这样可以与现有 `.ai.dev.config.json` 共存，不污染默认开发配置
- `VF_MOCK_PORT`、`VF_MOCK_API_KEY`、`BYTE_DANCE_GPT_API_KEY` 这类变量应显式设置，不要依赖本机环境碰巧可用

经验：临时配置必须可回滚。调试文档里要写“怎么接入”，但更重要的是写“跑完要恢复”。

### Worktree 本地配置回退

- worktree 下如果缺少 `.ai.dev.config.*`，loader 会回退到主 worktree 的 dev config。
- worktree 下如果缺少 `.env` / `.env.dev`，runtime 会回退到主 worktree 的环境文件。
- 这个回退只在“当前 worktree 没有本地文件”时生效；一旦当前 worktree 自己提供了文件，就以当前 worktree 为准。
- 如果改了主 worktree 的 `.env` 或 `.ai.dev.config.*`，需要重启服务端进程，不能只刷新浏览器。

### Worktree 旧进程串线

- 如果当前 worktree 的 provider 表现和本地配置不一致，优先检查是不是连到了别的 worktree 还活着的旧 server / router。
- 固定端口最容易出问题；先核对当前 worktree 的 router 配置文件和监听端口，再看实际请求落到哪个进程。
- `/api/config`、router 配置文件和进程日志三处都要对齐；只看浏览器报错很容易误判成 adapter 映射问题。
- 如果确认串线，先停掉旧实例，再重启当前 worktree 的 server / router。

### `ak not exist: \${BYT...}` 的判断方法

现象：

- `claude-code-router` 或上游 provider 返回 `401`
- 错误里出现 `ak not exist: ${BYT...}`、`${BYTE_DANCE_GPT_API_KEY}` 这类未展开片段

优先结论：

- 这通常不是模型服务本身坏了，而是环境变量没有展开
- provider 实际收到的是字面量 `${BYTE_DANCE_GPT_API_KEY}`，不是密钥值

优先检查：

- 当前 worktree 或主 worktree 的 `.env` 是否包含 `BYTE_DANCE_GPT_API_KEY`
- 服务端是不是在补齐 `.env` 之前就已经启动，需要重新拉起
- `/api/config` 里是否已经读到期望的 dev config，但环境变量仍是字面量占位符

经验：看到 `${BYT...}` 这种截断占位符时，不要先怀疑 adapter 映射。先确认 `.env` 是否真正进入了服务端和 adapter 子进程。

## 7. 最小可复用工作流

### 启动本地 mock host

```bash
node scripts/mock-responses-host.mjs
```

### 临时加一个 `mock-responses` model service

要点：

- `apiBaseUrl` 指向 `http://127.0.0.1:${VF_MOCK_PORT}/responses`
- `codex` / `opencode` 走 `wireApi: responses`
- `claude-code` 需要 `claudeCodeRouterTransformer` 把 mock model 接到 `openai-responses`

### 设置环境变量

```bash
export VF_MOCK_PORT=40111
export VF_MOCK_API_KEY=mock-key
export BYTE_DANCE_GPT_API_KEY=mock-key
```

### 用真实 CLI 复验

Codex 断流：

```bash
npx vf --print "trigger malformed stream" \
  --output-format stream-json \
  --adapter codex \
  --model mock-responses,mock-malformed-stream \
  --permission-mode dontAsk
```

Claude Code 400：

```bash
npx vf --print "trigger bad request" \
  --output-format stream-json \
  --adapter claude-code \
  --model mock-responses,mock-bad-request \
  --permission-mode dontAsk
```

如果要连退出码一起验证，优先用 `spawnSync` 包一层，直接看 `status`。

## 8. 最后才看实现文件

只有在分层判断和 smoke 结果都明确后，再回到实现。

常见落点：

- CLI 退出语义：`packages/cli-helper/loader.js`
- `run --print` 打印与退出：`apps/cli/src/commands/run.ts`
- `claude-code` 事件归一化：`packages/adapters/claude-code/src/protocol/incoming.ts`
- `codex` 流式错误归一化：`packages/adapters/codex/src/protocol/incoming.ts`
- mock host：`scripts/mock-responses-host.mjs`

经验：顺序反过来最容易浪费时间。先知道问题在哪一层，再决定改哪一个文件。
