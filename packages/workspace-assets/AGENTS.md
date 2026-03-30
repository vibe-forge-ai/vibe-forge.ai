# Workspace Assets 包说明

`@vibe-forge/workspace-assets` 承载 workspace asset bundle 发现、prompt asset 选择与 adapter asset plan 组装。

## 什么时候先看这里

- `.ai/rules`、`.ai/specs`、`.ai/entities`、`.ai/skills` 没有被正确投影到 workspace bundle
- 默认/显式 MCP server 选择结果不对
- promptAssetIds、system prompt 资产选择不对
- adapter native asset plan 或 opencode overlay 异常

## 入口

- `src/bundle.ts`
  - `resolveWorkspaceAssetBundle()`
- `src/prompt-selection.ts`
  - `resolvePromptAssetSelection()`
- `src/adapter-asset-plan.ts`
  - `buildAdapterAssetPlan()`
- `__tests__/bundle.spec.ts`
- `__tests__/prompt-selection.spec.ts`
- `__tests__/adapter-asset-plan.spec.ts`
- `__tests__/workspace-assets.snapshot.spec.ts`
- `__tests__/__snapshots__/workspace-assets-rich.snapshot.json`

## 当前边界

- 本包负责：
  - workspace asset bundle 组装
  - prompt asset 选择
  - adapter asset plan 组装
- 本包不负责：
  - 定义文档发现与解析
  - cache 存储
  - task 生命周期编排

## 维护约定

- 只维护 workspace asset 领域逻辑；定义文档读取留在 `@vibe-forge/definition-loader`，cache 留在 `@vibe-forge/utils`。
- 文档路径规范化与命名规则复用 `@vibe-forge/utils/document-path`，不要在本包重复维护。
- 共享 contract 继续依赖 `@vibe-forge/types`，不要把 task / hooks / mcp 逻辑反向塞进来。
- 新增 asset 类型、prompt 选择规则或 adapter 投影时，优先补对应职责下的 spec 文件，不要继续把单测堆回一个综合 spec。
- 影响 bundle / prompt selection / adapter plan 整体投影时，同步检查 `workspace-assets-rich.snapshot.json`；必要时用 `pnpm -C packages/workspace-assets test -- --update` 更新快照。
