# 架构分层

返回入口：[ARCHITECTURE.md](../ARCHITECTURE.md)

## 应用层

- `apps/cli`：主 CLI，负责编排 `vf run`、`vf list`、`vf clear`、`vf stop`、`vf kill`、`vf benchmark`。
- `apps/server`：UI server / session runtime，负责 HTTP / WebSocket 接口、会话启动、通知与配置写回。
- `apps/client`：Web UI，复用共享契约，不直接触达 benchmark runtime 或文件系统。

## 入口与运行时层

- `packages/cli-helper`：CLI loader，负责 `NODE_OPTIONS`、`@vibe-forge/register/preload` 和退出码透传。
- `packages/app-runtime`：对 `apps/*` 暴露 task / benchmark 入口，并携带默认 `vibe-forge` MCP 锚点。
- `packages/task`：任务执行层，负责 `prepare()`、`run()` 与 adapter query options。
- `packages/mcp`：独立 MCP stdio server，暴露 `vf-mcp` / `vibe-forge-mcp`。
- `packages/hooks`：独立 hooks runtime，暴露 `vf-call-hook`。
- `packages/benchmark`：benchmark 发现、workspace 准备、执行和结果读写。

## 共享与支撑层

- `packages/types`：`Config`、adapter contract / loader、task <-> mcp binding、session / ws 类型。
- `packages/core`：schema、channel DSL、env、ws 类型和统一导出。
- `packages/config`：`.ai.config.*` / `.ai.dev.config.*` 查找、变量替换、缓存重置、配置写回。
- `packages/utils`：logger、log level、字符串 key 转换、uuid、cache、message text 提取。
- `packages/definition-core`：definition 名称 / 标识 / 摘要语义、rule `always` 兼容、remote rule reference 投影。
- `packages/definition-loader`：rules / skills / specs / entities 发现、读取与解析。
- `packages/workspace-assets`：workspace assets 发现、hook 插件资产投影、prompt asset 选择与 prompt 文本拼装。
- `packages/register`：运行前预加载辅助层。

## 扩展实现层

- `packages/channels/lark`：channel definition / connection。
- `packages/adapters/*`：`codex`、`claude-code`、`opencode` 等 adapter 实现。
- `packages/plugins/*`：`logger`、`chrome-devtools` 等 hook plugin 实现。

## 相关约束

- 新增跨包能力时，先下沉共享 contract，再迁移实现。
- 跨 package 只走公开导出，不扩散私有深路径。
- `apps/client` 不直接依赖运行逻辑包。
