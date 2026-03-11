---
baseCommit: c63c09904b7768cb054c6034cc0a1ab1aef08cdb
setupCommand: pnpm install --frozen-lockfile
testCommand: pnpm exec vitest run apps/cli/__tests__/tools.spec.ts
timeoutSec: 600
---

在 `apps/cli/src/mcp-tools/general/` 目录下新建 `random-integer.ts`，实现一个 `random-integer` MCP 工具：

1. 工具名称为 `random-integer`，标题为 `Random Integer Tool`
2. 接受 `min`（整数，含）和 `max`（整数，含）两个必填字段
3. 当 `max < min` 时必须通过 Zod `.refine()` 或输入校验抛出验证错误
4. 返回在 `[min, max]` 范围内的随机整数（以字符串格式写入 `text` 字段）
5. 使用 `defineRegister` 包装并默认导出，在 `apps/cli/src/mcp-tools/index.ts` 的 `general` 分组中完成注册

不要修改测试文件以外的 benchmark 文件，不要引入额外依赖。
