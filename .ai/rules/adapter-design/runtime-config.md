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

## 原生 CLI 托管

原生 CLI 不作为 adapter package 的运行时依赖。npm 分发的 CLI 统一走 [`packages/utils/src/managed-npm-cli.ts`](../../../packages/utils/src/managed-npm-cli.ts)，Kimi 继续走 uv tool 安装；两者都必须把托管产物写到项目级共享 cache，而不是写进真实 home 或 adapter 依赖树。

查找顺序：

1. 显式 binary path：`adapters.<name>.cli.path` 或 `__VF_PROJECT_AI_ADAPTER_<NAME>_CLI_PATH__`
2. primary workspace 的共享 cache：`<primary>/.ai/caches/adapter-<name>/cli`
3. 系统 `PATH`
4. `autoInstall !== false` 时安装到共享 cache

worktree 场景下，共享 CLI cache 必须通过 [`packages/utils/src/project-cache-path.ts`](../../../packages/utils/src/project-cache-path.ts) 向主工作树归并。session share、mock home、日志仍然保持在当前 worktree，避免多个 worktree 互相污染会话状态。

用户侧版本控制入口：

- npm adapter：`adapters.<name>.cli.package`、`adapters.<name>.cli.version`、`adapters.<name>.cli.npmPath`
- `claude-code` 有两套 CLI：`cli` 是 Claude Code，`routerCli` 是 Claude Code Router
- Kimi：`adapters.kimi.cli.package`、`adapters.kimi.cli.version`、`adapters.kimi.cli.python`、`adapters.kimi.cli.uvPath`
- 环境变量覆盖遵循 `__VF_PROJECT_AI_ADAPTER_<NAME>_INSTALL_PACKAGE__`、`__VF_PROJECT_AI_ADAPTER_<NAME>_INSTALL_VERSION__`、`__VF_PROJECT_AI_ADAPTER_<NAME>_AUTO_INSTALL__`

预热入口：

- `vf adapter prepare` 只准备配置里 `prepareOnInstall: true` 的 CLI
- `vf adapter prepare --all` 准备所有已安装 adapter 暴露的 CLI target
- `vf adapter prepare codex claude-code gemini` 按 adapter 名显式准备；`claude-code.routerCli` / `ccr` 可单独准备 Claude Code Router
- `@vibe-forge/cli` 的 `postinstall` 只在项目根 `.ai.config.json` 或 `infra/.ai.config.json` 里发现 `adapters.<name>.cli.prepareOnInstall: true` / `routerCli.prepareOnInstall: true` 时触发同一套 prepare 逻辑
- postinstall 默认不在 `CI=true` 时执行；可以用 `VIBE_FORGE_POSTINSTALL_PREPARE=1` 显式允许，或用 `VIBE_FORGE_SKIP_ADAPTER_PREPARE=1` / `VIBE_FORGE_SKIP_POSTINSTALL=1` 跳过
- postinstall 失败默认只告警，不阻断依赖安装；需要严格失败时设置 `VIBE_FORGE_POSTINSTALL_STRICT=1`

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

## Copilot

- 实现入口：
  - [`packages/adapters/copilot/src/runtime/init.ts`](../../../packages/adapters/copilot/src/runtime/init.ts)
  - [`packages/adapters/copilot/src/runtime/shared.ts`](../../../packages/adapters/copilot/src/runtime/shared.ts)
  - [`packages/adapters/copilot/src/runtime/native-hooks.ts`](../../../packages/adapters/copilot/src/runtime/native-hooks.ts)
  - [`packages/adapters/copilot/src/runtime/session/stream.ts`](../../../packages/adapters/copilot/src/runtime/session/stream.ts)
- 自动生效内容：
  - 托管 `@github/copilot` CLI，默认版本 `1.0.36`
  - `.ai/.mock/copilot/settings.json` 里的 workspace trust、`configContent` 和 managed native hooks
  - session 级 `COPILOT_SKILLS_DIRS`、`COPILOT_CUSTOM_INSTRUCTIONS_DIRS`
  - `COPILOT_AGENT_DIRS`、`COPILOT_ADDITIONAL_CUSTOM_INSTRUCTIONS`
  - selected MCP servers 翻译成 `--additional-mcp-config`
  - `modelServices.extra.copilot` 映射到 `COPILOT_PROVIDER_*`，并通过本地 provider proxy 路由
  - `--plugin-dir`、`--allow-tool`、`--deny-tool`、`--allow-url`、`--deny-url`、`--add-dir`、`--mode`、`--remote` 等官方 CLI 参数

设计考量：

- Copilot CLI 当前主配置文件是 `settings.json`，旧 `config.json` 只作为读取兼容；adapter 写入 mock config dir，不写真实 `~/.copilot`
- `cli` 与 `configContent` 在 project/user 两层配置之间做深合并；这是 Copilot adapter 内部读取 `ctx.configs[0/1]` 时的显式语义，和 extends 链的 `deepMergeKeys` 互补
- `mode` 直接映射官方 `--mode`，并且官方禁止与 `--autopilot` / `--plan` 同时使用；所以 `mode` 存在时不再附加 `--autopilot` 或 `--plan`
- Copilot auth 仍由官方 CLI 自己维护，Vibe Forge 只桥接 mock home/keychain 并清晰暴露 auth 错误，不实现虚假的多账号列表
- native hooks 写入 mock `settings.json` 的 `hooks`，只禁用通用 bridge 中与 Copilot 原生重叠的 `PreToolUse` / `PostToolUse` / `Stop`

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
  - managed native hooks 对应的 `hooks` / `hooksConfig.enabled`
  - selected MCP servers 映射到 Gemini `mcpServers`
  - `.ai/.mock/.agents/skills -> .ai/skills`
  - telemetry / auto-update / relaunch 相关受控 env
  - `__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__`、`__VF_VIBE_FORGE_GEMINI_HOOKS_ACTIVE__` 与 Gemini native hook bridge env
  - routed `modelServices` 映射为本地 Gemini compatibility proxy，并写入 `security.auth.selectedType: gateway`、`security.auth.useExternal: true` 与 `GOOGLE_GEMINI_BASE_URL`

设计考量：

- Gemini 没有稳定公开的通用 `apiHost` / `apiBaseUrl` 适配器配置；不能照搬 Codex/OpenCode 的 provider 写法
- 外部模型路由继续走共享层 `modelServices`，但当前只接受 OpenAI-compatible `chat/completions` 服务
- direct 和 stream 共用同一套 mock-home / settings / native hooks / proxy 准备逻辑，只是进程 I/O 模式不同

## 共享层职责边界

- [`packages/task/src/run.ts`](../../../packages/task/src/run.ts)
  - 负责 adapter/model 选择、asset plan 和 hook bridge 去重
- [`packages/workspace-assets/src/adapter-asset-plan.ts`](../../../packages/workspace-assets/src/adapter-asset-plan.ts)
  - 负责“这个资产对该 adapter 应该是 native / translated / prompt / skipped”
- adapter 自己负责最终的原生目录、参数和 env
