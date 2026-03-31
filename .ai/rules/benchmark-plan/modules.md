# Benchmark 模块拆分

返回入口：[BENCHMARK-PLAN.md](../BENCHMARK-PLAN.md)

## 中间层

中间层位于 `packages/benchmark/src/`，建议拆成：

- `schema.ts`：`rfc.md` frontmatter 与 `result.json` schema
- `types.ts`：`BenchmarkCase`、`BenchmarkRunRequest`、`BenchmarkRunResult` 等
- `discover.ts`：扫描 `.ai/benchmark/<category>/<title>/`
- `workspace.ts`：准备共享 workspace 与 case 级隔离层
- `runner.ts`：单 case 执行、应用 patch、跑测试、生成结果
- `scheduler.ts`：category 内并发调度、取消、汇总
- `result-store.ts`：读写 `.ai/results/.../result.json`
- `index.ts`：统一对外 API

## 后端

- 建议新增 `apps/server/src/routes/benchmark.ts`
- 在 `apps/server/src/routes/index.ts` 挂载 `/api/benchmark`
- 只做 benchmark 的编排与读写接口，不重复实现核心逻辑

## CLI

- 建议新增 `apps/cli/src/commands/benchmark.ts`
- 在 `apps/cli/src/cli.ts` 注册 `benchmark` 子命令
- 只做参数解析、并发控制和终端摘要输出

## 前端

- 建议新增 `apps/client/src/components/BenchmarkView/`
- 新增 `apps/client/src/api/benchmark.ts`
- 增加 benchmark 导航入口与页面路由
- 前端不直接操作文件系统
