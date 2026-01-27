# MCP Server 环境参数注入与条件加载方案 (Updated)

本方案旨在实现以下目标：

1. 通过 `AdapterQueryOptions` 传递运行环境类型 (`runtime`)，**设为必传**。
2. 在 `packages/core` 中注入关键的环境变量（Host, Port, RunType）。
3. 在 `apps/cli` 中根据 `__VF_PROJECT_AI_RUN_TYPE__` 条件加载 `interaction` 类工具。

## 1. 核心层改造 (`packages/core`)

### 类型定义更新 (`src/adapter/type.ts`)

修改 `AdapterQueryOptions` 接口，增加 `runtime` 字段，且为必传。

```typescript
export interface AdapterQueryOptions {
  // ...
  runtime: 'server' | 'cli' // 必传字段
  // ...
}
```

### 环境变量注入 (`src/controllers/task/prepare.ts`)

修改 `prepare.ts`，在 `mcpServer.env` 中注入以下环境变量：

* `__VF_PROJECT_AI_SERVER_HOST__`: 从 `env.SERVER_HOST` 或默认值 `localhost` 获取。

* `__VF_PROJECT_AI_SERVER_PORT__`: 从 `env.SERVER_PORT` 或默认值 `8787` 获取。

* `__VF_PROJECT_AI_RUN_TYPE__`: 直接使用 `adapterOptions.runtime` 的值。

```typescript
// src/controllers/task/prepare.ts

mcpServer.env = {
  ...mcpServer.env,
  __VF_PROJECT_AI_TASK_ID__: taskId,
  __VF_PROJECT_AI_SESSION_ID__: sessionId,
  __VF_PROJECT_AI_SERVER_HOST__: env.SERVER_HOST ?? 'localhost',
  __VF_PROJECT_AI_SERVER_PORT__: env.SERVER_PORT ?? '8787',
  __VF_PROJECT_AI_RUN_TYPE__: adapterOptions.runtime
}
```

## 2. 调用方更新

### Server 端 (`apps/server/src/websocket/index.ts`)

在调用 `run` 方法时，显式传入 `runtime: 'server'`。

```typescript
const { session } = await run({
  // ...
}, {
  // ...
  runtime: 'server',
  // ...
})
```

### CLI 端 (`apps/cli/src/cli.ts`)

在调用 `run` 方法时，显式传入 `runtime: 'cli'`。

```typescript
run({
  // ...
}, {
  // ...
  runtime: 'cli',
  // ...
})
```

## 3. CLI 工具改造 (`apps/cli`)

### 条件加载工具 (`src/commands/mcp.ts`)

修改 `registerMcpCommand` 函数，在注册工具前检查环境变量。

* 读取 `process.env.__VF_PROJECT_AI_RUN_TYPE__`。

* 在遍历 `mcpTools.tools` 时，增加判断逻辑：

  * 如果 `category === 'interaction'` 且 `runType !== 'server'`，则跳过注册。

```typescript
// src/commands/mcp.ts

// ...
const runType = process.env.__VF_PROJECT_AI_RUN_TYPE__ ?? 'cli'

Object.entries(mcpTools.tools).forEach(([category, register]) => {
  // 只有在 server 环境下才加载 interaction 工具
  if (category === 'interaction' && runType !== 'server') {
    return
  }

  if (shouldEnableCategory(category, categoryFilter)) {
    register(proxyServer)
  }
})
```

### 工具实现更新 (`src/mcp-tools/interaction/ask-user.ts`)

更新 `AskUserQuestion` 工具，使其使用注入的环境变量来构建请求 URL。

```typescript
// src/mcp-tools/interaction/ask-user.ts

const host = process.env.__VF_PROJECT_AI_SERVER_HOST__ ?? 'localhost'
const port = process.env.__VF_PROJECT_AI_SERVER_PORT__ ?? '8787'
// ... fetch(`http://${host}:${port}/api/interact/ask`, ...)
```

## 执行步骤

1. **Core**: 修改 `src/adapter/type.ts` 增加 `runtime` 必传字段。
2. **Core**: 修改 `src/controllers/task/prepare.ts` 注入环境变量。
3. **Server**: 修改 `src/websocket/index.ts` 传入 `runtime: 'server'`。
4. **CLI**: 修改 `src/cli.ts` 传入 `runtime: 'cli'`。
5. **CLI**: 修改 `src/commands/mcp.ts` 添加条件加载逻辑。
6. **CLI**: 修改 `src/mcp-tools/interaction/ask-user.ts` 使用环境变量。

