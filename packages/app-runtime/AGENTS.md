# App Runtime 包说明

`@vibe-forge/app-runtime` 是给 `apps/*` 使用的 runtime facade。
它统一暴露 task / benchmark 的 app-facing API，并携带内建 `VibeForge` MCP 的安装锚点。

## 什么时候先看这里

- `apps/cli` 或 `apps/server` 不该再直接依赖 `@vibe-forge/task` / `@vibe-forge/benchmark` / `@vibe-forge/mcp`
- 想确认 app 层到底应该从哪里拿任务运行和 benchmark API
- 默认内建 MCP 在发布态安装后解析异常

## 入口

- `src/index.ts`
  - 透传 `@vibe-forge/task`
  - 透传 `@vibe-forge/benchmark`

## 当前边界

- 本包负责：
  - app-facing runtime API 收口
  - 内建 `@vibe-forge/mcp` 的安装锚点
- 本包不负责：
  - 任务生命周期编排实现
  - benchmark 领域实现
  - MCP server 实现

## 维护约定

- 这里只做 package-level facade，不要再堆业务逻辑。
- app 层需要 task / benchmark 能力时，优先从这里拿，不要重新回到底层 runtime 包。
- 新增 facade 导出时，保持与底层包的命名一致，不要再包一层零语义函数。
