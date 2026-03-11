---
baseCommit: c63c09904b7768cb054c6034cc0a1ab1aef08cdb
setupCommand: pnpm install --frozen-lockfile
testCommand: pnpm exec vitest run apps/cli/__tests__/proxy.spec.ts
timeoutSec: 600
---

在 `apps/cli/src/mcp-tools/proxy.ts` 中为过滤器增加否定前缀（negation）能力：

1. `include` 或 `exclude` 列表中，以 `!` 开头的值表示"强制排除此名称"
2. 否定规则的优先级高于所有肯定匹配规则，例如 `include: ['tool', '!tool']` 最终结果是排除 `tool`
3. `!` 之后的内容必须与名称完全匹配（否定前缀不支持通配符）
4. 单独使用 `include: ['!tool-debug']` 等价于 `exclude: ['tool-debug']`（仅含否定项的 include 不形成正向约束）
5. `shouldEnableCategory` 和 `createFilteredRegister` 内的 `shouldEnable` 都需要支持否定语法

不要修改测试文件以外的 benchmark 文件，不要引入额外依赖。
