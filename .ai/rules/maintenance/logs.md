# 日志消费与排查

## 先看主日志，再看适配器日志

- 主任务日志默认落在 `.ai/logs/<ctxId>/<sessionId>.log.md`。
- 适配器协议转换日志默认落在 `.ai/logs/<ctxId>/<sessionId>/adapter-claude-code/*`。
- `.ai/.mock/.claude-code-router/` 更偏运行时内部状态，不是业务排查的第一入口。

推荐顺序：

1. 先看主日志，确认这次任务到底加载了哪些 rules、skills、entity、spec。
2. 再看 adapter 日志，确认真正发给模型的 request 和收到的 response 是什么。
3. 只有怀疑 CCR 复用、session 继承或 header 传递异常时，再看 `.ai/.mock`。

## 先回答什么问题，再决定看哪一层

### 1. 怀疑上下文加载不对

优先看主日志里的 `[GenerateSystemPrompt] [plugin.logger]` 段。

适合排查：

- rules 没有进入上下文
- skill 没有加载、重复加载、或被错误路由
- entity / spec 注入结果不符合预期
- `adapterOptions.systemPrompt` 的最终内容不对

主日志使用共享 logger 输出，结构化数据会被渲染成 YAML，多行文本使用 `>-`，更适合直接阅读和 diff。

### 2. 怀疑请求进模型前被改坏

优先看 adapter 日志里的两段：

- `transformRequestIn`
- `transformRequestIn resolved input`

前者表示上游传入 transformer 前的原始请求，后者表示 transformer 处理后的真实输入。两者对比通常可以快速判断：

- system prompt 有没有被拆错
- tools 有没有被改写错
- messages / input 的转换是否符合预期
- 额外的 title 请求和主任务请求是否被混在一起

### 3. 怀疑模型回了，但展示或协议处理不对

优先看 adapter 日志里的 `transformResponseOut`。

当前 CCR 日志已经支持：

- `application/json` 响应完整打印
- `text/event-stream` 先解析 SSE，再拼成 assembled 结果后打印

排查流式响应时，优先读 assembled 结果，不要先手工读原始 `data:` chunk。

## 实际阅读顺序

推荐每次都按同一顺序读，降低噪音：

1. 找到本次任务目录：`.ai/logs/<ctxId>/`
2. 打开主日志：`.ai/logs/<ctxId>/<sessionId>.log.md`
3. 搜索 `[GenerateSystemPrompt] [plugin.logger]`
4. 搜索 `adapterOptions.systemPrompt`
5. 如需下钻，再打开 `adapter-claude-code/openai-polyfill.js.log.md`
6. 先读 `transformRequestIn resolved input`
7. 再读 `transformResponseOut`

## 复现建议

- 复现时优先显式传 `--session-id`，方便稳定定位目录和做前后对比。
- 排查目录串台问题时，区分 `ctxId` 和 `sessionId`，不要只看一个字段。
- 交互模式可能有额外的 title 请求；看到 `Generate a concise, sentence-case title...` 时，不要误判成主任务 prompt。

## 常见判断模板

### 规则为什么没生效

- 看主日志里的 `data.rules`
- 再看 `adapterOptions.systemPrompt`

### skill 为什么没加载或重复加载

- 看主日志里的 assets 选择结果
- 再看最终 `systemPrompt` 是否真的内联了 skill 内容，还是只给了 route guide

### 为什么发给模型的格式不对

- 看 adapter 日志里的 `transformRequestIn resolved input`

### 为什么流式响应难看或不完整

- 看 `transformResponseOut` 的 assembled 结果

### 为什么会多出一个日志目录

- 先确认这是不是额外请求导致的正常目录
- 再确认 session header、ctx/session 映射、CCR daemon 复用是否异常

## clear 的作用边界

`npx vf clear` 会清理日志和 cache 产物，但日志异常不一定都是 clear 没生效。

遇到下面这类问题时，要额外考虑 CCR daemon 仍在复用：

- 旧 session 的日志还在被继续写入
- 第二次启动时 adapter 日志落错目录
- 主日志正常，但 adapter 日志落到了另一处

这类问题优先看 request 上下文和 CCR 运行态，而不是只盯 `.ai/logs` 目录本身。
