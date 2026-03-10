# Benchmark 实施规划

## 1. 目标

本规划用于把 benchmark 技术方案落成可交付的产品能力，覆盖以下四个方向：

- 前端界面开发
- 后端接口开发
- CLI 指令开发
- 中间层设计

目标不是一次性做全，而是先建立一套可复用、可扩展的 benchmark 运行骨架，再逐步补齐交互和可视化。

## 2. 总体实施原则

- benchmark 的领域能力统一下沉到 `packages/core`
- CLI 和后端都直接复用 `packages/core` 的 benchmark controller
- 前端不直接操作文件系统，只通过后端接口读取配置、发起运行、展示结果
- benchmark 运行目录遵循现有规范：
  - case 输入目录：`.ai/benchmark/<category>/<title>/`
  - workspace 目录：`.ai/worktress/benchmark/<category>/`
  - 结果目录：`.ai/results/<category>/<title>/result.json`
- 同一 `category` 下的 case 允许并行，但实现上必须通过 case 级写隔离保证共享 workspace 不被并发污染

## 3. 架构拆分

### 3.1 中间层

中间层放在 `packages/core/src/controllers/benchmark/`，负责承接 benchmark 的核心领域能力。

建议拆分为以下模块：

- `schema.ts`
  - 定义 `rfc.md` frontmatter schema
  - 定义 `result.json` schema
- `types.ts`
  - 定义 `BenchmarkCase`
  - 定义 `BenchmarkCategory`
  - 定义 `BenchmarkRunRequest`
  - 定义 `BenchmarkRunResult`
  - 定义 `BenchmarkRunEvent`
- `discover.ts`
  - 扫描 `.ai/benchmark/<category>/<title>/`
  - 读取并解析 `rfc.md`
  - 组装 case 列表和 category 视图
- `workspace.ts`
  - 准备 `.ai/worktress/benchmark/<category>/`
  - 维护共享 workspace 与依赖准备缓存
  - 为每个 case 分配独立可写隔离层
- `runner.ts`
  - 执行单 case 跑分
  - 应用候选 patch 与 `patch.test.diff`
  - 运行测试
  - 调用 judge
  - 生成 `result.json`
- `scheduler.ts`
  - 负责 category 内并发调度
  - 控制并发数
  - 负责任务取消、失败短路和状态汇总
- `result-store.ts`
  - 负责读写 `.ai/results/.../result.json`
  - 提供最近结果查询和结果汇总
- `index.ts`
  - 对外暴露统一 controller API

### 3.2 后端

后端只提供 benchmark 的编排与读写接口，不重复实现核心逻辑。建议新增：

- `apps/server/src/routes/benchmark.ts`
- 在 `apps/server/src/routes/index.ts` 挂载 `/api/benchmark`

后端只做以下职责：

- 调用 `packages/core` 的 benchmark controller
- 维护运行态任务列表
- 向前端暴露 HTTP 查询与启动接口
- 在需要时向 websocket 广播运行进度

### 3.3 CLI

CLI 直接复用 `packages/core` 的 benchmark controller，不单独实现跑分逻辑。建议新增：

- `apps/cli/src/commands/benchmark.ts`
- 在 `apps/cli/src/cli.ts` 注册 `benchmark` 子命令

CLI 的职责：

- 指定 `category`
- 指定 `title`
- 批量运行 case
- 控制并发
- 输出终端摘要

### 3.4 前端

前端新增 benchmark 页面，读取后端接口展示 case 配置、运行状态和结果摘要。建议新增：

- `apps/client/src/components/BenchmarkView/`
- `apps/client/src/api/benchmark.ts`
- 在 `apps/client/src/App.tsx` 增加 `/benchmark`
- 在 `apps/client/src/components/NavRail.tsx` 增加 benchmark 导航入口
- 在 `apps/client/src/resources/locales/zh.json` 与 `en.json` 增加文案

## 4. 分阶段任务目标

### 4.1 第一阶段：中间层 MVP

目标：

- 建立 benchmark 的核心运行能力
- 让 CLI 和后端都能复用同一套 controller

完成项：

- 扫描 `.ai/benchmark/<category>/<title>/`
- 解析 `rfc.md`
- 准备 `.ai/worktress/benchmark/<category>/`
- 建立 category 级共享 workspace
- 建立 case 级隔离层
- 支持单 case 执行
- 支持 category 批量执行
- 生成 `.ai/results/<category>/<title>/result.json`

验收标准：

- 可以从本地 benchmark 目录发现 case
- 可以运行单 case
- 可以按 category 批量跑分
- 能正确产出 `result.json`
- CLI 与后端调用的是同一套中间层接口

### 4.2 第二阶段：CLI 能力

目标：

- 在终端支持指定类型、用例、批量跑分

建议命令形态：

```bash
vf benchmark list
vf benchmark run --category backend-basic
vf benchmark run --category backend-basic --title add-login-rate-limit
vf benchmark run --category backend-basic --title add-login-rate-limit --concurrency 4
```

完成项：

- `vf benchmark list`
  - 列出 category 与 case
- `vf benchmark run`
  - 支持按 `category` 批量运行
  - 支持按 `category + title` 运行单 case
  - 支持设置并发数
  - 支持输出摘要
- `vf benchmark show`
  - 读取 `.ai/results/.../result.json`

验收标准：

- 能在终端完成 benchmark 列表查看
- 能按 category 批量执行
- 能按单 case 执行
- 能读取并打印最近一次结果摘要

### 4.3 第三阶段：后端接口

目标：

- 让前端能够读取 benchmark 配置并发起运行

建议接口：

- `GET /api/benchmark/categories`
  - 返回 category 列表与用例数量
- `GET /api/benchmark/cases`
  - 返回 case 列表，支持按 `category` 过滤
- `GET /api/benchmark/cases/:category/:title`
  - 返回单 case 配置摘要
- `GET /api/benchmark/results`
  - 返回结果列表，支持按 `category`、`title` 过滤
- `GET /api/benchmark/results/:category/:title`
  - 返回单 case 的 `result.json`
- `POST /api/benchmark/run`
  - 发起单 case 或 category 级跑分任务
- `GET /api/benchmark/runs/:runId`
  - 查询运行状态

后端内部能力：

- 将 HTTP 请求转换为中间层 `BenchmarkRunRequest`
- 维护内存中的运行态映射
- 在任务结束后提供结果查询

验收标准：

- 前端可以通过接口读取 benchmark 列表
- 前端可以发起跑分任务
- 前端可以轮询或订阅运行状态
- 前端可以读取 `result.json` 的摘要与明细

### 4.4 第四阶段：前端页面

目标：

- 新增 benchmark 页面，提供“配置查看 + 运行 + 结果展示”

页面建议拆分：

- `BenchmarkView`
  - 页面容器，负责数据拉取与状态编排
- `BenchmarkSidebar`
  - 展示 category 和 case
- `BenchmarkConfigPanel`
  - 展示 `rfc.md` frontmatter 解析结果和任务目标摘要
- `BenchmarkRunPanel`
  - 提供运行按钮、运行态、并发配置
- `BenchmarkResultPanel`
  - 展示 `result.json` 摘要和子分项

首版页面能力：

- 查看 category 列表
- 查看 case 列表
- 查看单 case 配置
- 运行单 case
- 运行整个 category
- 查看最新结果

后续增强能力：

- 展示运行队列与历史
- 展示多次结果对比
- 展示 category 汇总面板

验收标准：

- 前端能加载 benchmark 列表
- 前端能展示 case 的配置摘要
- 前端能发起跑分
- 前端能显示运行状态与结果

## 5. 中间层复用设计

这是本次实施的核心，必须先定清楚。

中间层对外建议暴露以下 API：

- `listCategories()`
- `listCases(input)`
- `getCase(input)`
- `runCase(input)`
- `runCategory(input)`
- `getResult(input)`
- `listResults(input)`

后端复用方式：

- route handler 直接调用上述 API
- 对 `runCase` 和 `runCategory` 做异步任务封装
- 将运行事件转换成接口返回值或 websocket 消息

CLI 复用方式：

- command action 直接调用上述 API
- 将运行事件输出到终端
- 将结束结果格式化展示

这样可以保证：

- benchmark 核心逻辑只有一份
- CLI 与后端行为一致
- 后续若增加自动化跑分，也可以继续复用这层

## 6. 与现有仓库结构的对应关系

### 6.1 前端

建议参照 `AutomationView` 的页面组织方式实现 benchmark 页面，因为当前仓库已经具备：

- 独立页面组件目录
- 对应 API 封装
- `App.tsx` 的路由接入点
- `NavRail.tsx` 的导航入口

建议新增文件：

- `apps/client/src/components/BenchmarkView/index.tsx`
- `apps/client/src/components/BenchmarkView/BenchmarkView.scss`
- `apps/client/src/api/benchmark.ts`

需要改动的现有文件：

- `apps/client/src/App.tsx`
- `apps/client/src/components/NavRail.tsx`
- `apps/client/src/api.ts`
- `apps/client/src/resources/locales/zh.json`
- `apps/client/src/resources/locales/en.json`

### 6.2 后端

建议新增文件：

- `apps/server/src/routes/benchmark.ts`

需要改动的现有文件：

- `apps/server/src/routes/index.ts`

### 6.3 CLI

建议新增文件：

- `apps/cli/src/commands/benchmark.ts`

需要改动的现有文件：

- `apps/cli/src/cli.ts`

### 6.4 Core

建议新增目录：

- `packages/core/src/controllers/benchmark/`

需要改动的现有文件：

- `packages/core/src/index.ts`

## 7. 推荐开发顺序

建议按下面顺序推进：

1. 先做 `packages/core` 中间层
2. 再做 CLI 跑通本地 benchmark
3. 再做后端 API
4. 最后做前端页面

原因：

- benchmark 的真实复杂度在运行编排，不在 UI
- CLI 是最短验证链路，可以最快暴露中间层设计问题
- 后端与前端都应建立在中间层稳定之后

## 8. 里程碑定义

### 里程碑 A：可运行

- core 可发现 case
- core 可跑单 case
- core 可写 `result.json`
- CLI 可调用

### 里程碑 B：可批量

- core 可跑 category
- 支持 category 内并发
- 结果可汇总

### 里程碑 C：可服务化

- 后端可暴露 benchmark 接口
- 支持任务发起与状态查询

### 里程碑 D：可视化

- 前端页面可查看 case
- 可发起运行
- 可展示结果

## 9. 风险点

- category 内并发虽然共享一个 workspace 语义，但不能并发改写同一个物理 checkout，必须依赖 case 级隔离层
- `setup_command` 若含副作用，需要明确定义 category 内复用边界
- `patch.test.diff` 若依赖实现细节，会降低 benchmark 的可信度
- 前端若要求实时日志，需要额外设计事件流接口；首版可只做运行状态与结果轮询

## 10. 结论

本次规划建议以 `packages/core` 为 benchmark 领域中台，CLI 与后端全部复用这层能力，前端只负责配置展示、任务发起和结果查看。

如果按该顺序推进，最短路径是：

1. 先完成中间层 MVP
2. 用 CLI 跑通单 case 与 category
3. 再补后端接口
4. 最后补前端页面

这样能以最低成本验证 benchmark 的核心设计，并避免前后端各自实现一套跑分逻辑。
