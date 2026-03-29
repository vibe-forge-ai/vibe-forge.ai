# Repo Reading Guide

开始处理仓库前，先读 `.ai/rules/` 下的规则与维护文档。

优先阅读：

- `.ai/rules/RULE-CODING-STYLE.md`
- `.ai/rules/RULE-ARCHITECTURE.md`
- `.ai/rules/RULE-MAINTENANCE.md`

按任务继续阅读：

- 仓库架构与分层：`.ai/rules/ARCHITECTURE.md`
- 仓库开发与贡献：`.ai/rules/DEVELOPMENT.md`
- 项目接入方式：`.ai/rules/USAGE.md`
- hooks 方案与维护：`.ai/rules/HOOKS.md`、`.ai/rules/HOOKS-REFERENCE.md`
- benchmark 方案与规划：`.ai/rules/BENCHMARK.md`、`.ai/rules/BENCHMARK-PLAN.md`
- 当前重构待办：`.ai/rules/REFACTOR-TODO.md`
- 发布与更新日志：`changelog/`

维护约定：

- 以 `.ai/rules/` 为统一文档入口，不再以仓库根 `docs/` 作为主入口。
- 更新日志统一维护在仓库根目录 `changelog/`。
- AGENTS 与文档只描述现状，不记录迁移历史。
