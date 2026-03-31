# Hooks 实现入口

返回入口：[HOOKS-REFERENCE.md](../HOOKS-REFERENCE.md)

## 共用层

- `packages/hooks/src/native.ts`：mock home、托管脚本路径、native 配置写入 helper
- `packages/hooks/src/bridge.ts`：结构化 `tool_use/tool_result` 到统一 hook 事件
- `packages/hooks/src/runtime.ts`：读取 hook 输入、装载插件、执行 middleware 链
- `packages/config/src/load.ts`：配置加载、变量替换与缓存
- `packages/utils/src/create-logger.ts`：markdown logger
- `packages/utils/src/log-level.ts`：log level 解析
- `packages/utils/src/string-transform.ts`：hook 输入 key 转换
- `packages/task/src/run.ts`：native / bridge 去重策略
- `packages/workspace-assets/src/adapter-asset-plan.ts`：workspace hook 插件、native 资产与 overlay 规划
- `apps/cli/src/hooks/*.ts`：CLI 侧 hook 入口
- `packages/hooks/call-hook.js`

## Adapter 入口

- Codex：`packages/adapters/codex/src/hook-bridge.ts`
- Claude Code：`packages/adapters/claude-code/src/hook-bridge.ts`
- OpenCode：`packages/adapters/opencode/src/hook-bridge.ts`

## E2E 与工具

- `scripts/run-tools.mjs`：脚本 loader
- `scripts/cli.ts`：统一挂载 `adapter-e2e` / `publish-plan`
- `scripts/adapter-e2e/harness.ts`：suite 调度与结果汇总
- `scripts/adapter-e2e/runners.ts`：真实 CLI 运行与 fallback 选择
- `scripts/adapter-e2e/log.ts`：hook 日志解析
- `scripts/adapter-e2e/snapshot.ts`：快照投影
