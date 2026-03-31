# Benchmark 判定与结果

返回入口：[BENCHMARK.md](../BENCHMARK.md)

## Judge 输入

judge 只接收这几类输入：

- `rfc.md` 的任务目标
- 候选 patch
- `patch.diff`
- `patch.test.diff` 执行后的测试结果

不再构造多阶段 prompt 链，也不额外生成中间 judge 文件。

## 判定逻辑

- 先看 `patch.test.diff` 对候选实现的验收结果。
- 再结合 `rfc.md` 与 `patch.diff` 判断是否遗漏关键行为。
- 目标是判断“任务是否完成”，不是做字面级 diff 比对。

## 状态定义

- `passed`：测试通过，judge 认定任务完成。
- `failed`：测试失败，或 judge 认定关键目标未完成。
- `error`：执行、环境准备或 judge 过程出现系统性错误。
- `timeout`：超过 `timeout_sec`。

## 评分模型

- 测试结果是硬约束；测试未过时不能评为完成。
- judge 负责补充“等价实现是否满足目标”的语义判断。
- 评分重点放在任务完成度、行为正确性和验收一致性，不比较文本风格。

## `result.json`

建议至少包含：

- case 标识：`category`、`title`
- 运行元信息：`base_commit`、`duration_ms`、`timeout_sec`
- 执行结果：`status`、`test_exit_code`、`test_summary`
- judge 结果：`judge_summary`、`score`

## 风险

- 共享 workspace 的并发风险，本质上靠 case 级写隔离解决。
- 测试补丁如果绑定实现细节，会把 benchmark 变成答案匹配器。
- `base_commit` 与环境准备命令不稳定时，会直接影响结果可信度。
