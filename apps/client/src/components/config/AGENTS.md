# Config 组件维护说明

本目录承载配置页与 worktree environment 编辑器；涉及以下入口时，先读本文件：

- `../ConfigView.tsx`
- `WorktreeEnvironmentPanel.tsx`
- `use-worktree-environment-auto-save.ts`
- `configConflict.ts`
- `../../hooks/use-session-subscription.ts`
- `../../hooks/session-subscription-cache.ts`

## 当前设计

配置文件被 CLI、手动编辑或 extends 链路中的文件改动后，后端会通过 websocket 广播 `config_updated`。前端订阅层只负责刷新 `/api/config` 及其派生缓存，不直接覆盖本地草稿；真正的冲突处理留在配置编辑器内部完成。

配置页和 worktree environment 编辑器都遵循相同的“三份状态”模型：

- `base`：开始编辑时或上次成功保存后的远端基线。
- `draft`：用户当前正在修改的本地草稿。
- `server`：收到 `config_updated` 后重新拉取到的最新远端值。

## 不变式

- 不要在 `use-session-subscription.ts` 收到 `config_updated` 后直接覆盖本地编辑状态；订阅层只能触发 revalidate。
- 主配置编辑器按 `source + section` 做冲突判断，不要退化成整页级别的统一提示。
- `draft === base` 且 `server !== base` 时，说明用户未改动，可直接把草稿同步到远端最新值。
- `draft !== base` 且 `server !== base` 且 `draft !== server` 时，必须视为真实冲突：暂停自动保存并要求用户显式选择。
- 冲突出现时，不允许静默偏向本地或远端；必须通过确认框让用户选择“保留当前编辑”或“采用外部修改”。
- 用户选择前，该草稿的自动保存必须保持阻断状态，避免背景定时器把另一份内容写回去。
- `ConfigView.tsx` 与 `use-worktree-environment-auto-save.ts` 的行为需要保持一致；不要只修一条编辑链路，另一条继续静默覆盖。
- `configConflict.ts` 负责共享比较逻辑；比较时需要归一化对象 key 顺序，避免仅因字段顺序不同而误判冲突。

## 修改建议

- 如果需要调整冲突交互，优先保留 “先拦截自动保存，再让用户选择” 这个顺序。
- 如果需要新增配置编辑入口，接入同样的 `base / draft / server` 语义，而不是只复用自动保存逻辑。
- 如果需要修改 websocket 或缓存刷新逻辑，确认配置草稿仍然只在编辑器内部合并，不要把合并责任上提到订阅层。

## 最低验证

修改这块后，至少验证：

- `pnpm exec eslint apps/client/src/components/ConfigView.tsx apps/client/src/components/config/*.ts* apps/client/src/hooks/use-session-subscription.ts apps/client/src/hooks/session-subscription-cache.ts`
- `pnpm exec vitest run --workspace vitest.workspace.ts apps/client/__tests__/config-conflict.spec.ts apps/client/__tests__/session-subscription-cache.spec.ts`
- 如果改动了配置表单渲染，再补 `apps/client/__tests__/config-schema-form.spec.tsx`
