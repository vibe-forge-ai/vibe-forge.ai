# Benchmark 阶段目标

返回入口：[BENCHMARK-PLAN.md](../BENCHMARK-PLAN.md)

## 第一阶段：中间层 MVP

- 扫描 `.ai/benchmark/<category>/<title>/`
- 解析 `rfc.md`
- 准备 `.ai/worktress/benchmark/<category>/`
- 建立 category 级共享 workspace 与 case 级隔离层
- 支持单 case 执行与 category 批量执行
- 生成 `.ai/results/<category>/<title>/result.json`

验收标准：CLI 与后端调用的是同一套中间层接口。

## 第二阶段：CLI 能力

- `vf benchmark list`
- `vf benchmark run --category <category>`
- `vf benchmark run --category <category> --title <title>`
- `vf benchmark show`

验收标准：能列出 case、跑单 case、批量跑 category、读取最近结果。

## 第三阶段：后端接口

- `GET /api/benchmark/categories`
- `GET /api/benchmark/cases`
- `GET /api/benchmark/results`
- `POST /api/benchmark/run`
- `GET /api/benchmark/runs/:runId`

验收标准：前端可以读取列表、发起运行、查询状态和结果。

## 第四阶段：前端页面

- 配置查看
- 运行控制
- 结果摘要和详情展示

验收标准：页面能完成“查看配置 + 发起运行 + 查看结果”的闭环。
