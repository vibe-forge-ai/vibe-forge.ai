# Benchmark 开发顺序

返回入口：[BENCHMARK-PLAN.md](../BENCHMARK-PLAN.md)

## 推荐顺序

1. 先做 `packages/benchmark` 的 discover / workspace / runner / result-store。
2. 再接 CLI，让终端能先跑通单 case 和批量执行。
3. 然后接 Server API，复用同一套 runtime。
4. 最后再做前端页面和运行态展示。

## 里程碑

- 里程碑 A：可运行
  - 单 case 可以在本地稳定跑通并产出 `result.json`
- 里程碑 B：可批量
  - category 级批量执行与结果汇总可用
- 里程碑 C：可服务化
  - Server API 可启动、可查询、可展示运行状态
- 里程碑 D：可视化
  - 前端页面形成完整使用闭环

## 风险点

- workspace 共享与 case 并发隔离实现复杂度高
- 测试补丁若写得过细，会削弱 benchmark 的泛化价值
- 后端和 CLI 若各自分叉 runtime，会导致行为漂移
