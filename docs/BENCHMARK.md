# 基于 LLM 上层应用任务完成能力的 Benchmark 技术方案

## 1. 目标

本方案用于定义一套面向 LLM 上层应用的任务完成能力 benchmark 标准。评测目标不是比较模型输出文本，而是判断模型是否能够基于给定任务目标，在真实代码仓库中完成可验证的工程改动。

评测输入固定为每个 case 下的三个文件：

- `rfc.md`：任务目标
- `patch.diff`：参考实现
- `patch.test.diff`：验收测试补丁

评测输出固定为一个结果文件：

- `result.json`

## 2. 设计原则

- 任务目标只来自 `rfc.md`，不再拆分额外 judge prompt 链。
- `patch.test.diff` 是主验收标准。
- `patch.diff` 是参考实现，不做字面级唯一答案匹配。
- 同一个 `category` 下的 case 允许并行执行，并共享同一个 benchmark workspace。
- 不同 `category` 之间必须隔离推断环境与运行环境。
- 每个 case 最终只保留一个 `result.json`，不额外落盘中间产物。

## 3. 目录约定

### 3.1 Case 目录

每个 benchmark case 的目录结构固定为：

```text
.ai/benchmark/<category>/<title>/
  rfc.md
  patch.diff
  patch.test.diff
```

约束如下：

- `category` 表示一组可共享同一 benchmark workspace 的用例集合。
- `title` 表示单个任务用例名称，建议使用 kebab-case。
- 一个目录只表示一个 case。

示例：

```text
.ai/
  benchmark/
    backend-basic/
      add-login-rate-limit/
        rfc.md
        patch.diff
        patch.test.diff
    backend-isolated/
      migrate-auth-flow/
        rfc.md
        patch.diff
        patch.test.diff
```

### 3.2 运行目录

benchmark 运行时目录固定为：

```text
.ai/
  worktress/
    benchmark/
      <category>/
  results/
    <category>/
      <title>/
        result.json
```

说明：

- `.ai/worktress/benchmark/<category>/` 是 `category` 级共享 benchmark workspace。
- `.ai/results/<category>/<title>/result.json` 是 case 级唯一结果文件。
- 运行目录属于系统产物，不纳入 benchmark case 本身。

## 4. 输入文件规范

### 4.1 `rfc.md`

`rfc.md` 同时承载任务元信息和任务目标正文。建议使用 frontmatter 表达最小必要配置。

示例：

```md
---
base_commit: abcdef1
setup_command: pnpm install --frozen-lockfile
test_command: pnpm vitest run
timeout_sec: 900
---

实现登录接口限流能力：
1. 同一 IP 在 1 分钟内最多失败 5 次
2. 超限后返回 429
3. 不修改客户端逻辑
```

字段说明：

- `base_commit`：评测基线提交。
- `setup_command`：初始化命令，用于准备依赖或生成物。
- `test_command`：应用验收测试补丁后的执行命令。
- `timeout_sec`：单 case 最大执行时长。

除上述字段外，不引入 `tags`、`difficulty`、`allow_paths`、`forbid_paths` 等额外约束字段。

### 4.2 `patch.diff`

`patch.diff` 表示参考实现，作用如下：

- 为 judge 提供目标实现参考。
- 用于辅助判断候选实现是否遗漏关键行为。
- 不作为唯一正确答案。

约束：

- 必须能在 `base_commit` 上 clean apply。
- 应覆盖 `rfc.md` 中定义的任务目标。

### 4.3 `patch.test.diff`

`patch.test.diff` 表示验收测试补丁，作用如下：

- 在基线仓库上补充或修改测试，形成统一验收标准。
- 与候选实现组合后执行 `test_command`。

约束：

- 必须优先验证外部行为，而不是绑定参考实现细节。
- 必须能同时验证参考实现和等价实现。
- 不应通过检查内部变量、私有函数或硬编码文本来限制实现方式。

## 5. Category 与 Workspace 模型

### 5.1 Category 的语义

`category` 是 benchmark 的运行隔离单元。

同一个 `category` 下的 case 满足以下前提：

- 可以共享同一个 benchmark workspace。
- 可以共享相同的依赖安装结果和基础缓存。
- 可以在相同的推断环境配置下执行。

不同 `category` 的 case 必须分开，适用于以下场景：

- 需要不同依赖版本。
- 需要不同系统工具或权限。
- 需要不同模型配置、工具集或推断隔离策略。

### 5.2 共享 Workspace 的实现约束

同一个 `category` 下的 case 被定义为并行运行在一个 workspace 下，但原生 `git worktree` 不支持多个任务同时对同一 checkout 做安全的 `reset`、`apply`、`checkout` 和测试写入。

因此本方案采用“共享基线 workspace + case 级写隔离”的实现方式：

- `category` 级共享 workspace 位于 `.ai/worktress/benchmark/<category>/`。
- 该 workspace 负责提供基线仓库、依赖缓存和公共文件视图。
- 每个并行 case 在执行阶段分配独立的可写隔离层。
- 隔离层可以通过以下任一方式实现：
  - 基于共享 workspace 的文件系统 snapshot / reflink copy
  - overlayfs 或等价的 copy-on-write 目录层
  - 其他不破坏共享 workspace 基线状态的写隔离机制

这里的“运行在一个 workspace 下”指的是：

- 共享同一个 category 基线目录和依赖准备结果
- 共享同一个推断环境类别
- 不要求多个 case 直接并发写同一个物理 checkout

这是保证并行能力与执行正确性的必要约束。

## 6. 执行流程

单个 case 的标准执行流程如下。

### 6.1 初始化

1. 解析 `.ai/benchmark/<category>/<title>/`。
2. 读取 `rfc.md` frontmatter，获取 `base_commit`、`setup_command`、`test_command`、`timeout_sec`。
3. 准备 `category` 级共享 workspace：`.ai/worktress/benchmark/<category>/`。
4. 确保共享 workspace 对应到正确仓库，并具备 `base_commit` 所需对象。

### 6.2 环境准备

1. 在共享 workspace 上同步到 `base_commit` 对应的基线内容。
2. 执行一次 `setup_command`，并缓存结果。
3. 为当前 case 创建独立的可写隔离层。

约束：

- 同一 `category` 下若多个 case 的 `base_commit` 和 `setup_command` 兼容，可以复用准备结果。
- 若不兼容，应拆分到不同 `category`。

### 6.3 候选实现生成

1. 将 `rfc.md` 正文作为任务目标输入给待测 agent。
2. agent 在当前 case 的隔离层中完成代码修改。
3. runner 从隔离层提取候选改动，归一化为候选 patch。

说明：

- `rfc.md` 是唯一任务输入，不构造额外任务说明链。
- 候选 patch 只作为运行时内存对象使用，不要求额外落盘。

### 6.4 验收执行

1. 在当前 case 的干净基线隔离层上应用候选 patch。
2. 应用 `patch.test.diff`。
3. 执行 `test_command`。
4. 记录测试退出码、耗时和关键日志摘要。

### 6.5 结果判定

1. 将 `rfc.md`、候选 patch、`patch.diff`、测试结果输入单次 judge。
2. judge 输出任务完成度判定。
3. runner 汇总测试结果与 judge 结果，生成 `result.json`。

## 7. 判定规则

### 7.1 判定输入

judge 的输入只包含以下内容：

- `rfc.md` 的任务目标
- 候选 patch
- `patch.diff`
- `patch.test.diff` 执行后的测试结果

不引入多阶段 prompt 链，不额外生成中间 judge 文件。

### 7.2 判定逻辑

judge 需要完成三类判断：

1. 候选实现是否完成 `rfc.md` 中定义的任务目标。
2. 候选实现是否存在明显的测试规避行为。
3. 相比 `patch.diff`，候选实现是否遗漏关键行为。

其中：

- 测试结果是主信号。
- `patch.diff` 仅作为参考行为对照，不用于要求代码结构相同。
- 若候选实现通过测试但明显绕过真实需求，judge 可降低完成度评分。

### 7.3 状态定义

- `pass`：测试通过，且 judge 认为任务目标已完成。
- `partial`：存在部分完成，例如测试通过但目标覆盖不完整，或测试未完全通过但已有有效实现。
- `fail`：候选实现不可用，或测试失败且 judge 认为未完成任务目标。

## 8. 评分模型

建议采用如下评分：

- `test_score`：0 或 1，表示验收测试是否通过。
- `goal_score`：0 到 1，表示 `rfc.md` 目标完成度。
- `reference_score`：0 到 1，表示与 `patch.diff` 在关键行为上的一致程度。

最终得分建议为：

```text
final_score = 0.7 * test_score + 0.2 * goal_score + 0.1 * reference_score
```

说明：

- `test_score` 权重最高，保证 benchmark 可客观复现。
- `goal_score` 用于覆盖测试未完全表达的任务目标。
- `reference_score` 用于降低“过测试但偏题”的结果得分。

## 9. `result.json` 规范

每个 case 最终只输出一个 `result.json`，建议结构如下：

```json
{
  "category": "backend-basic",
  "title": "add-login-rate-limit",
  "status": "pass",
  "final_score": 0.94,
  "scores": {
    "test_score": 1.0,
    "goal_score": 0.9,
    "reference_score": 0.8
  },
  "base_commit": "abcdef1",
  "duration_ms": 182341,
  "setup_command": "pnpm install --frozen-lockfile",
  "test_command": "pnpm vitest run",
  "test_exit_code": 0,
  "judge_summary": "核心行为完成，验收测试通过，未发现明显的测试规避实现。",
  "issues": [],
  "timestamp": "2026-03-10T10:30:00+08:00"
}
```

字段说明：

- `category`：case 所属类别。
- `title`：case 名称。
- `status`：`pass | partial | fail`。
- `final_score`：最终分数。
- `scores`：子分项。
- `base_commit`：执行基线。
- `duration_ms`：总耗时。
- `setup_command`：实际使用的初始化命令。
- `test_command`：实际使用的测试命令。
- `test_exit_code`：测试退出码。
- `judge_summary`：单段摘要结论。
- `issues`：问题列表，记录未完成项、风险项或失败原因。
- `timestamp`：结果生成时间。

## 10. 并行调度策略

### 10.1 调度原则

- 同一 `category` 下的 case 可以并行。
- 不同 `category` 之间相互隔离，也可以并行。
- 调度器优先保证 `category` 内共享准备结果的复用率。

### 10.2 推荐执行策略

- 以 `category` 为一级调度分组。
- 每个 `category` 维持一个长生命周期共享 workspace。
- 每个 case 在启动时从共享 workspace 分配一个独立可写隔离层。
- `setup_command` 默认在 `category` 级去重执行。
- `test_command` 在 case 级隔离层中独立执行。

这样可以同时满足以下目标：

- 共享依赖安装成本
- 共享仓库对象和缓存
- 保持 case 级文件改动互不污染
- 允许 category 内并行评测

## 11. MVP 范围

第一阶段建议只实现以下能力：

- 支持扫描 `.ai/benchmark/<category>/<title>/`
- 支持解析 `rfc.md`
- 支持准备 `.ai/worktress/benchmark/<category>/`
- 支持 category 内并行 case 调度
- 支持应用候选 patch 与 `patch.test.diff`
- 支持执行单次 judge
- 支持输出 `.ai/results/<category>/<title>/result.json`

第一阶段不做以下能力：

- 多轮交互式 judge
- 复杂路径权限约束
- 多仓库联合任务
- 多结果产物归档
- 基于代码字面 diff 的精细相似度分析

## 12. 风险与约束

### 12.1 共享 Workspace 的并发风险

如果直接让多个 case 并发写同一个物理 `git worktree`，会出现以下问题：

- `git reset --hard` 互相覆盖
- `git apply` 互相污染
- 测试运行产物互相干扰
- 临时文件、锁文件和构建缓存不稳定

因此实现上必须引入 case 级写隔离层，不能把“共享 workspace”理解为“多个 case 并发写同一个 checkout 目录”。

### 12.2 测试补丁设计风险

若 `patch.test.diff` 过度绑定参考实现细节，会导致 benchmark 误杀等价实现。因此维护 benchmark 时必须优先编写行为级测试。

### 12.3 基线兼容性风险

同一个 `category` 内若混入不兼容的 `base_commit`、依赖版本或工具链要求，会破坏共享 workspace 的复用价值。因此 category 的划分需要以运行环境兼容性为边界。

## 13. 总结

本方案定义了一套以 `rfc.md` 为任务目标、以 `patch.test.diff` 为主验收标准、以 `patch.diff` 为参考实现的 benchmark 机制。

核心设计点如下：

- case 目录固定为 `.ai/benchmark/<category>/<title>/`
- 运行目录固定为 `.ai/worktress/benchmark/` 与 `.ai/results/`
- 同一 `category` 共享一个 benchmark workspace
- 同一 `category` 内的 case 支持并行，但必须做 case 级写隔离
- 每个 case 最终只生成一个 `result.json`

该方案的目标是在保持本地批量执行效率的同时，保证评测可复现、可扩展，并能正确表达 LLM 在真实工程任务中的完成能力。
