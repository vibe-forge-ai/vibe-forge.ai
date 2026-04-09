# Adapter 设计总览

返回入口：[ADAPTERS.md](../ADAPTERS.md)

## 设计目标

Vibe Forge 的 adapter 不是简单“换个 binary 名字”，而是负责把统一 workspace 语义翻译成各家 agent 的原生运行时：

- 统一配置：`.ai.config.*` / `.ai.dev.config.*`
- 统一资产：skills、MCP、hooks、adapter-native overlay
- 统一运行参数：model、effort、permissions、resume、system prompt

翻译后的结果必须满足两件事：

1. 尽量走各家 agent 的原生能力，而不是把一切都塞回系统提示词。
2. 不污染用户真实 home；所有托管产物都落在 workspace 自己的 `.ai/.mock`、`.ai/caches` 或 session config dir。

## 运行阶段

### 1. 准备阶段

- [`packages/task/src/prepare.ts`](../../../packages/task/src/prepare.ts)
  - 加载 project config 和 dev config
  - 处理 worktree 到主工作树的 dev config fallback
  - 生成 `WorkspaceAssetBundle`

### 2. 选择阶段

- [`packages/task/src/run.ts`](../../../packages/task/src/run.ts)
  - 解析默认 adapter / model
  - 合并 `config` 与 `userConfig`
  - 为支持原生资产规划的 adapter 构建 `AdapterAssetPlan`

### 3. Adapter init

- adapter `init()` 负责 home 级或 mock-home 级托管内容
- 典型内容：
  - native hooks 配置
  - 认证软链
  - 原生 skills 目录软链

### 4. Adapter query

- adapter `query()` 负责 session 级内容
- 典型内容：
  - `--settings` / `--mcp-config`
  - `-c mcp_servers.*`
  - `OPENCODE_CONFIG_DIR`
  - session 级 plugin staging

## 资产分类

### Home 级资产

这类资产适合在 init 时同步到 mock home：

- hooks 托管文件
- 稳定的原生 skills 目录
- 认证文件软链

判断标准：

- 不依赖单次任务的 include/exclude 选择
- 路径稳定，适合长期存在于 mock home
- agent 会在启动时自动发现

### Session 级资产

这类资产要在 query 时生成：

- 选中的 MCP server 集合
- session 级 plugin staging
- 带 overlay 的技能/commands/agents/config dir

判断标准：

- 会被 `options.skills` / `options.mcpServers` / overlay 影响
- 同一个 workspace 不同会话可能不同

### Prompt 级资产

当某类资产没有稳定原生映射时，仍然会被映射到生成的系统提示词。

这层语义由 [`packages/workspace-assets/src/adapter-asset-plan.ts`](../../../packages/workspace-assets/src/adapter-asset-plan.ts) 产出诊断，状态包含：

- `native`
- `translated`
- `prompt`
- `skipped`

## 为什么统一走 `.ai/.mock`

- 真实 home 保持不变，降低本地环境污染和回归风险
- worktree、E2E、CLI smoke 都能复用同一套隔离布局
- adapter 可以用“看起来像原生 home”的方式启用各家 CLI 的自动发现逻辑

## 官方文档

- Claude Code Skills: [https://code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)
- OpenAI Codex Skills: [https://developers.openai.com/codex/skills](https://developers.openai.com/codex/skills)
- OpenCode Agent Skills: [https://opencode.ai/docs/skills](https://opencode.ai/docs/skills)
