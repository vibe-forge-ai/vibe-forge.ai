# Benchmark 执行模型

返回入口：[BENCHMARK.md](../BENCHMARK.md)

## Category 与 Workspace

- `category` 是 benchmark 的运行隔离单元。
- 同一 `category` 下的 case 可以共享基线仓库、依赖安装结果和推断环境配置。
- 不同 `category` 必须分开，适用于依赖版本、系统工具、权限或模型配置不同的场景。

## 共享 Workspace 约束

- `git worktree` 不适合多个任务直接并发写同一 checkout。
- 实现上采用“共享基线 workspace + case 级写隔离”。
- 每个并发 case 都要有独立可写隔离层，可以用 snapshot / reflink copy / overlayfs 等机制。

## 单 case 流程

1. 解析 case 目录，读取 `rfc.md` frontmatter。
2. 准备 `category` 级共享 workspace。
3. 同步到 `base_commit`，执行一次 `setup_command` 并缓存结果。
4. 为当前 case 创建独立可写隔离层。
5. 将 `rfc.md` 正文作为唯一任务输入交给待测 agent。
6. 从隔离层提取候选改动，归一化为候选 patch。
7. 在干净基线隔离层上应用候选 patch 与 `patch.test.diff`。
8. 执行 `test_command`，记录退出码、耗时和关键日志摘要。
9. 调用 judge，汇总结果并生成 `result.json`。

## 并行调度

- 同一 `category` 可以并行，但必须通过 case 级写隔离避免互相污染。
- 若多个 case 的 `base_commit` 或 `setup_command` 不兼容，应拆到不同 `category`。
- 调度优先保证共享准备结果可复用，其次再追求并发度。
