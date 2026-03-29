# Benchmark 包说明

`@vibe-forge/benchmark` 承载 benchmark 的发现、运行、workspace 准备与结果读写。

## 什么时候先看这里

- `vf benchmark` 行为异常
- server benchmark API 返回结果不对
- benchmark case 发现、workspace 隔离、结果汇总有问题
- 想确认 benchmark 为什么复用的是哪一层 task runtime

## 入口

- `src/discover.ts`
  - 发现 category / case，解析 `rfc.md`
- `src/workspace.ts`
  - 准备 benchmark workspace 与 case 隔离层
- `src/runner.ts`
  - 运行单 case / category
  - 通过 `@vibe-forge/task` 调用任务执行能力
- `src/result-store.ts`
  - 读写 `.ai/results/.../result.json`
- `src/schema.ts`
  - benchmark frontmatter / result schema
- `src/types.ts`
  - benchmark 共享类型

## 边界约定

- benchmark 领域逻辑集中在本包
- CLI 和 server 通过 `@vibe-forge/app-runtime` 消费本包 runtime
- client 只消费 `@vibe-forge/types` 里的 benchmark contract
- 真正的任务执行仍由 `@vibe-forge/task` 负责
- 不要把 benchmark 运行逻辑重新散回 `apps/cli`、`apps/server` 或 `packages/core`
