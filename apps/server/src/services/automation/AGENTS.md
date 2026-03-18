# Automation 服务目录说明

- index.ts：automation 子域的稳定导出入口，供 route 或其他 service 引用
- execution.ts：规则执行编排，负责 legacy 数据补齐、会话创建与 run 记录落库
- scheduler.ts：触发器调度与 timer 生命周期，负责 interval/cron 初始化、重建与取消

边界约定：automation 子域只负责规则调度和执行编排；HTTP 参数校验放在 routes/automation.ts，持久化访问统一走 db/。

理解路径建议：先读 index.ts 了解对外能力，再读 execution.ts 看 rule 如何落到 session，最后读 scheduler.ts 理解触发器如何驱动执行。