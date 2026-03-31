# Benchmark 技术方案

本文件是 benchmark 方案入口页，只保留目标、范围和阅读顺序；细节拆到 `benchmark/`。

## 先看这些

- [目录与输入](./benchmark/layout.md)：case 布局、输入文件和目录约定。
- [执行模型](./benchmark/execution.md)：category、workspace、执行流程和并发。
- [判定与结果](./benchmark/evaluation.md)：judge、评分、状态和 `result.json`。

## 目标

- 评测重点不是模型输出文本，而是模型是否能在真实代码仓库中完成可验证的工程改动。
- 固定输入为 `rfc.md`、`patch.diff`、`patch.test.diff`。
- 固定输出为 `.ai/results/<category>/<title>/result.json`。

## 总体原则

- 任务目标只来自 `rfc.md`。
- `patch.test.diff` 是主验收标准。
- `patch.diff` 是参考实现，不做唯一答案匹配。
- 同一 `category` 共享 benchmark workspace，但执行时必须有 case 级写隔离。

## 继续阅读

- [Benchmark 实施规划](./BENCHMARK-PLAN.md)
- [本仓库开发与贡献](./DEVELOPMENT.md)
