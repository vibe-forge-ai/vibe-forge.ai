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

- 实现入口：
  - [`packages/adapters/claude-code/src/claude/init.ts`](../../../packages/adapters/claude-code/src/claude/init.ts)
  - [`packages/adapters/claude-code/src/claude/prepare.ts`](../../../packages/adapters/claude-code/src/claude/prepare.ts)
- 自动生效内容：
  - mock-home `.claude.json` 里的 workspace trust state
  - `settingsContent` / `nativeEnv`
  - permissions
  - selected MCP servers
  - `--settings`
  - `--mcp-config`
  - `--plugin-dir`
  - routed model service 对应的 Claude Code Router

设计考量：

- Claude 原生已经有稳定 `settings.json` 和 `--mcp-config`
- 项目信任状态又落在 `~/.claude.json`，所以 init 阶段需要先把 mock-home app state 补齐，再由 query 阶段把会话级共享配置投影成 Claude 原生 settings

## Codex

- 实现入口：
  - [`packages/adapters/codex/src/runtime/init.ts`](../../../packages/adapters/codex/src/runtime/init.ts)
  - [`packages/adapters/codex/src/runtime/session-common.ts`](../../../packages/adapters/codex/src/runtime/session-common.ts)
- 自动生效内容：
  - mock-home `.codex/config.toml` 里的 workspace trust 与 startup update 默认值
  - `developer_instructions`
  - `model_provider.*`
  - `mcp_servers.*`
  - `features.*`
  - native hooks feature

设计考量：

- Codex 更偏向 `config.toml` / `-c key=value` 覆盖
- 所以 init 阶段会先在 mock home 写最基础的原生配置（workspace trust、`check_for_update_on_startup`），query 阶段再把会话级共享配置编译成多组 `-c` 参数

## OpenCode

- 实现入口：
  - [`packages/adapters/opencode/src/runtime/native-hooks.ts`](../../../packages/adapters/opencode/src/runtime/native-hooks.ts)
  - [`packages/adapters/opencode/src/runtime/session/child-env.ts`](../../../packages/adapters/opencode/src/runtime/session/child-env.ts)
- 自动生效内容：
  - mock-home fallback `opencode.json` 里的 `$schema` / `autoupdate`
  - 合并后的 `opencode.json`
  - selected MCP servers
  - permissions
  - model/provider config
  - session 级 skills / overlays
  - `OPENCODE_CONFIG_DIR`

设计考量：

- OpenCode 允许整个 session config dir 成为原生边界
- 官方文档没有单独的 workspace trust key；当前 workspace 直接受 permissions 规则约束，额外目录才走 `permission.external_directory`
- 所以这里最适合把 MCP、skills、commands、agents、modes 一起收敛进一个 session config root，并把 update 提示压到 mock-home/session config 这一层处理

## Gemini

- 实现入口：
  - [`packages/adapters/gemini/src/runtime/init.ts`](../../../packages/adapters/gemini/src/runtime/init.ts)
  - [`packages/adapters/gemini/src/runtime/shared.ts`](../../../packages/adapters/gemini/src/runtime/shared.ts)
  - [`packages/adapters/gemini/src/runtime/session/direct.ts`](../../../packages/adapters/gemini/src/runtime/session/direct.ts)
  - [`packages/adapters/gemini/src/runtime/session/stream.ts`](../../../packages/adapters/gemini/src/runtime/session/stream.ts)
- 自动生效内容：
  - `GEMINI_CLI_HOME=.ai/.mock`
  - 托管的 `.ai/.mock/.gemini/settings.json`
  - selected MCP servers 映射到 Gemini `mcpServers`
  - `.ai/.mock/.agents/skills -> .ai/skills`
  - telemetry / auto-update / relaunch 相关受控 env
  - routed `modelServices` 映射为本地 Gemini compatibility proxy，并写入 `security.auth.selectedType: gateway`、`security.auth.useExternal: true` 与 `GOOGLE_GEMINI_BASE_URL`

设计考量：

- Gemini 没有稳定公开的通用 `apiHost` / `apiBaseUrl` 适配器配置；不能照搬 Codex/OpenCode 的 provider 写法
- 外部模型路由继续走共享层 `modelServices`，但当前只接受 OpenAI-compatible `chat/completions` 服务
- direct 和 stream 共用同一套 mock-home / settings / proxy 准备逻辑，只是进程 I/O 模式不同

## 共享层职责边界

- [`packages/task/src/run.ts`](../../../packages/task/src/run.ts)
  - 负责 adapter/model 选择、asset plan 和 hook bridge 去重
- [`packages/workspace-assets/src/adapter-asset-plan.ts`](../../../packages/workspace-assets/src/adapter-asset-plan.ts)
  - 负责“这个资产对该 adapter 应该是 native / translated / prompt / skipped”
- adapter 自己负责最终的原生目录、参数和 env
