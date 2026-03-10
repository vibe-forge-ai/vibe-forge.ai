---
baseCommit: 16e9296adebf8e619c14e4a573b4ae8ac126d6ad
setupCommand: pnpm install --frozen-lockfile
testCommand: pnpm exec vitest run apps/cli/__tests__/proxy.spec.ts
timeoutSec: 900
---

在 `apps/cli/src/mcp-tools/proxy.ts` 中为过滤器增加简单通配符能力：

1. `include` / `exclude` 中的 `*` 表示匹配全部
2. 形如 `prefix*` 的值表示按前缀匹配
3. 精确值匹配保持原有行为不变
4. `shouldEnableCategory` 和 `createFilteredRegister` 需要共享同一套匹配逻辑

不要修改测试文件以外的 benchmark 文件，不要引入额外依赖。
