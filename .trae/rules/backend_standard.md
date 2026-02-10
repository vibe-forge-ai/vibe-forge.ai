---
alwaysApply: false
globs: apps/server/src/**/*, apps/cli/src/**/*
---

# 后端开发规范 (Backend Development)

## 路由挂载 (Server)

- 所有的路由必须在 `src/server.ts` 中显式挂载到 `/api` 前缀下。
- 每个业务模块应有独立的 Router 文件。

## 数据处理 (Server)

- 使用 `src/db.ts` 提供的 `getDb()` 获取数据库实例。
- 数据持久化基于 `better-sqlite3`。
- 所有的 SQL 操作应在 `db.ts` 中封装为方法，避免在 Router 中直接编写 SQL。
- 复杂的业务逻辑应从路由处理函数中提取。

## 外部适配器 (Adapters)

- 所有的 CLI 或 AI 助手调用必须封装在 `src/adapters` 目录下。
- 必须遵循 `defineAdapter` 规范，实现标准的事件回调和退出处理。
- 适配器应负责特定工具的命令行参数构建和输出流解析（如 JSON 解析）。

## MCP 工具开发 (CLI)

- **注册规范**: 所有的 MCP 工具必须使用 `defineRegister` 包裹，并提供明确的 `title`, `description` 和 `inputSchema`。
- **命名规范**: 工具名称必须使用 **PascalCase** (例如 `StartTasks`, `GetTaskStatus`)。
- **参数校验**: 必须使用 `zod` 定义严格的输入 Schema。
- **任务管理**: 涉及耗时操作的任务工具应支持 `background` 模式，并提供状态查询机制。

**示例代码**:

```typescript
import { z } from 'zod'
import { defineRegister } from '../types'

export default defineRegister((server) => {
  server.registerTool(
    'MyCustomTool', // PascalCase
    {
      title: 'My Custom Tool',
      description: 'A brief description of what this tool does',
      inputSchema: z.object({
        param1: z.string().describe('Description for param1'),
        param2: z.number().optional().describe('Description for param2')
      })
    },
    async ({ param1, param2 }) => {
      // Implementation logic
      return {
        content: [{ type: 'text', text: `Result: ${param1}` }]
      }
    }
  )
})
```

## 错误处理

- 使用 try-catch 包裹异步操作。
- Server 端返回统一的 JSON 错误格式：`{ error: "message" }`。
- 控制台日志应带有明确的前缀（如 `[server]`, `[cli]`, `[mcp]`）。
