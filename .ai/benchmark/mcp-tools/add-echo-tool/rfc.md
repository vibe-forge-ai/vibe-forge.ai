---
baseCommit: c63c09904b7768cb054c6034cc0a1ab1aef08cdb
setupCommand: pnpm install --frozen-lockfile
testCommand: pnpm exec vitest run apps/cli/__tests__/tools.spec.ts
timeoutSec: 600
---

在 `apps/cli/src/mcp-tools/general/` 目录下新建 `echo.ts`，实现一个 `echo` MCP 工具：

1. 工具名称为 `echo`，标题为 `Echo Tool`
2. 接受单个字符串字段 `message`（必填），描述为 `The message to echo back`
3. 输出内容为 `Echo: {message}`（类型为 `text`）
4. 按照 `wait.ts` 的方式，使用 `defineRegister` 包装并默认导出
5. 在 `apps/cli/src/mcp-tools/index.ts` 的 `general` 分组中完成注册

不要修改测试文件以外的 benchmark 文件，不要引入额外依赖。
