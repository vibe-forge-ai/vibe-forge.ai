---
baseCommit: c63c09904b7768cb054c6034cc0a1ab1aef08cdb
setupCommand: pnpm install --frozen-lockfile
testCommand: pnpm exec vitest run apps/cli/__tests__/proxy.spec.ts
timeoutSec: 600
---

在 `apps/cli/src/mcp-tools/proxy.ts` 中，为 `createFilteredRegister` 的返回值增加统计方法 `getStats()`：

1. `getStats()` 返回 `{ registered: number; disabled: number }` 对象
2. `registered` 记录通过此代理登记的工具/提示/资源总数
3. `disabled` 记录因过滤规则被禁用的总数
4. 每次调用 `registerTool`、`registerPrompt`、`registerResource` 时，`registered` 自动加一；若该条目被 `disable()`，`disabled` 也加一
5. 返回类型需正确扩展：`Parameters<Register>[0] & { getStats: () => { registered: number; disabled: number } }`

不要修改测试文件以外的 benchmark 文件，不要引入额外依赖。
