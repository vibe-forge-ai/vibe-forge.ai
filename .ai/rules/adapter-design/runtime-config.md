# 运行时配置

返回入口：[ADAPTERS.md](../ADAPTERS.md)

## 配置加载

统一入口是 [`packages/task/src/prepare.ts`](../../../packages/task/src/prepare.ts)：

1. 计算 `cwd`
2. 生成 `jsonVariables`
3. 调 [`packages/config/src/load.ts`](../../../packages/config/src/load.ts) 读取 project config 和 dev config
4. 解析 workspace assets

## Worktree dev config fallback

当当前 worktree 没有 `.ai.dev.config.json/.yaml/.yml` 时，`loadConfig()` 会尝试回退到主工作树已有的 dev config。

当前支持：

- `.ai.dev.config.json`
- `.ai.dev.config.yaml`
- `.ai.dev.config.yml`
- `infra/` 下对应文件

这层语义在 [`packages/config/src/load.ts`](../../../packages/config/src/load.ts) 和 [`packages/config/src/update.ts`](../../../packages/config/src/update.ts) 里保持一致；`.env` 也有类似的主工作树 fallback，在 [`packages/register/dotenv.js`](../../../packages/register/dotenv.js)。

## 配置自动生效的含义

“自动生效”不是把一份配置原样复制给所有 adapter，而是：

1. 先在共享层合并 `config + userConfig`
2. 再由 adapter 根据自己的原生能力做翻译

因此同一份 workspace 配置会产生不同的原生结果。

## Claude Code

- 实现入口：[`packages/adapters/claude-code/src/claude/prepare.ts`](../../../packages/adapters/claude-code/src/claude/prepare.ts)
- 自动生效内容：
  - `settingsContent` / `nativeEnv`
  - permissions
  - selected MCP servers
  - `--settings`
  - `--mcp-config`
  - `--plugin-dir`
  - routed model service 对应的 Claude Code Router

设计考量：

- Claude 原生已经有稳定 `settings.json` 和 `--mcp-config`
- 所以优先把共享配置投影成 Claude 原生 settings，而不是把这些规则重新描述一遍给 prompt

## Codex

- 实现入口：[`packages/adapters/codex/src/runtime/session-common.ts`](../../../packages/adapters/codex/src/runtime/session-common.ts)
- 自动生效内容：
  - `developer_instructions`
  - `model_provider.*`
  - `mcp_servers.*`
  - `features.*`
  - native hooks feature

设计考量：

- Codex 更偏向 `config.toml` / `-c key=value` 覆盖
- 所以共享配置在这里会被编译成多组 `-c` 参数，而不是落成单个文件

## OpenCode

- 实现入口：[`packages/adapters/opencode/src/runtime/session/child-env.ts`](../../../packages/adapters/opencode/src/runtime/session/child-env.ts)
- 自动生效内容：
  - 合并后的 `opencode.json`
  - selected MCP servers
  - permissions
  - model/provider config
  - session 级 skills / overlays
  - `OPENCODE_CONFIG_DIR`

设计考量：

- OpenCode 允许整个 session config dir 成为原生边界
- 所以这里最适合把 MCP、skills、commands、agents、modes 一起收敛进一个 session config root

## 共享层职责边界

- [`packages/task/src/run.ts`](../../../packages/task/src/run.ts)
  - 负责 adapter/model 选择、asset plan 和 hook bridge 去重
- [`packages/workspace-assets/src/adapter-asset-plan.ts`](../../../packages/workspace-assets/src/adapter-asset-plan.ts)
  - 负责“这个资产对该 adapter 应该是 native / translated / prompt / skipped”
- adapter 自己负责最终的原生目录、参数和 env
