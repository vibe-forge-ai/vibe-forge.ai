# 原生资产适配

返回入口：[ADAPTERS.md](../ADAPTERS.md)

## 统一语义

adapter 不是直接扫描 `.ai/skills`、`.ai/mcp`、插件目录然后各自随意处理；统一入口是：

- [`packages/workspace-assets/src/adapter-asset-plan.ts`](../../../packages/workspace-assets/src/adapter-asset-plan.ts)
- [`packages/task/src/run.ts`](../../../packages/task/src/run.ts)

`AdapterAssetPlan` 负责告诉 runtime：

- 哪些 MCP 最终生效
- 哪些 skill / overlay 需要投影到原生目录
- 每个资产是 `native`、`translated`、`prompt` 还是 `skipped`

## 各 adapter 的落点

| Adapter       | Hooks                                                                       | Skills                                                                                                         | MCP                                                | 其他原生资产                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude-code` | `.ai/.mock/.claude/settings.json`                                           | `.ai/.mock/.claude/skills -> .ai/skills`                                                                       | 选中 MCP 写进 cache 文件，再用 `--mcp-config` 注入 | keychains 软链到 mock home；managed `.claude.json` 写 workspace trust state；managed Claude plugins stage 到 `.ai/caches/<ctx>/<session>/.claude-plugins` |
| `codex`       | `.ai/.mock/.codex/hooks.json`                                               | `.ai/.mock/.agents/skills -> .ai/skills`，并把每个 workspace skill 目录软链到 `.ai/.mock/.codex/skills/<name>` | 翻译成 `-c mcp_servers.<name>.*`                   | auth 软链到 `.ai/.mock/.codex/auth.json`；managed `config.toml` 写 workspace trust 与 update-check 默认值                                                 |
| `gemini`      | `.ai/.mock/.gemini/settings.json` 里的 `hooks` / `hooksConfig`               | `.ai/.mock/.agents/skills -> .ai/skills`                                                                       | 写进 `.ai/.mock/.gemini/settings.json` 的 `mcpServers` | `.ai/.mock/.gemini/settings.json`、本地 Gemini compatibility proxy、`GEMINI_CLI_HOME`                                                                    |
| `opencode`    | `.ai/.mock/.config/opencode/opencode.json` 与 `plugins/vibe-forge-hooks.js` | session 级 `OPENCODE_CONFIG_DIR/skills`                                                                        | 写进最终 `opencode.json`                           | fallback `opencode.json` 默认写 `$schema` 与 `autoupdate: false`；`agents/commands/modes/plugins` 与 overlay 一起进入 session config dir                  |

## Claude Code

- init 阶段把 `.ai/skills` 软链到 [`packages/adapters/claude-code/src/claude/init.ts`](../../../packages/adapters/claude-code/src/claude/init.ts) 里的 `.ai/.mock/.claude/skills`，并写 mock-home `.claude.json` 项目信任状态
- query 阶段在 [`packages/adapters/claude-code/src/claude/prepare.ts`](../../../packages/adapters/claude-code/src/claude/prepare.ts) 写 `--settings`、`--mcp-config`，并 stage `--plugin-dir`

设计考量：

- Claude 原生会发现 `~/.claude/skills`、`.claude/skills` 和 plugin skills，但没有稳定的 `--skills-dir`
- 所以最简单、最稳定的方式是让 mock home 模拟个人级 skills 目录
- Claude 的 workspace trust state 落在 `~/.claude.json.projects[<cwd>]`，也必须在 mock home 一起补齐
- plugin 属于 session 级能力，因为它要经过安装记录、session cache 和 `--plugin-dir` 启用链路

官方文档：

- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)

## Codex

- init 阶段把 `.ai/skills` 软链到 [`packages/adapters/codex/src/runtime/init.ts`](../../../packages/adapters/codex/src/runtime/init.ts) 里的 `.ai/.mock/.agents/skills`，把每个 skill 目录镜像进 `.ai/.mock/.codex/skills/<name>`，并写 managed `.ai/.mock/.codex/config.toml`
- query 阶段在 [`packages/adapters/codex/src/runtime/session-common.ts`](../../../packages/adapters/codex/src/runtime/session-common.ts) 注入 `developer_instructions`、`mcp_servers.*`、feature flags 和 provider overrides

设计考量：

- Codex 官方文档里的用户级 skills 入口仍是 `.agents/skills`
- 但当前真实运行时会在 `.codex/skills/.system` 下维护系统技能；只同步 `.agents/skills` 会和这条真实加载路径脱节
- 所以现在保持两处都同步：`.agents/skills` 继续承载用户级入口，`.codex/skills/<name>` 承载与当前 Codex 运行时兼容的镜像，hooks / auth / managed config 仍留在 `.codex/`

官方文档：

- [Codex Skills](https://developers.openai.com/codex/skills)
- [Codex AGENTS.md](https://developers.openai.com/codex/agents-md)
- [Codex Hooks](https://developers.openai.com/codex/hooks)

## OpenCode

- init 阶段在 [`packages/adapters/opencode/src/runtime/native-hooks.ts`](../../../packages/adapters/opencode/src/runtime/native-hooks.ts) 托管 mock config dir
- query 阶段在 [`packages/adapters/opencode/src/runtime/session/skill-config.ts`](../../../packages/adapters/opencode/src/runtime/session/skill-config.ts) 和 [`packages/adapters/opencode/src/runtime/session/child-env.ts`](../../../packages/adapters/opencode/src/runtime/session/child-env.ts) 生成 session 级 `OPENCODE_CONFIG_DIR`

设计考量：

- OpenCode 已经有成熟的 session config dir 方案，且 Vibe Forge 暴露了 `include-skill` / `exclude-skill`
- 官方 config/permissions 文档没有单独的 trust-state；当前 workspace 直接按 permission 规则运行，额外目录才走 `permission.external_directory`
- 如果在 init 时把整棵 `.ai/skills` 全量挂进 mock home，会绕过 session 级 skills 选择和 overlay 规划
- 所以 OpenCode 保持“hooks 在 mock home，skills/agents/commands/modes 在 session config dir”的双层结构

官方文档：

- [OpenCode Agent Skills](https://opencode.ai/docs/skills)
- [OpenCode Config](https://opencode.ai/docs/config/)

## Gemini

- init 阶段把 `.ai/skills` 软链到 [`packages/adapters/gemini/src/runtime/init.ts`](../../../packages/adapters/gemini/src/runtime/init.ts) 里的 `.ai/.mock/.agents/skills`
- init 阶段在 [`packages/adapters/gemini/src/runtime/native-hooks.ts`](../../../packages/adapters/gemini/src/runtime/native-hooks.ts) 预备 managed hook runtime，并标记 `__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__`
- query 阶段在 [`packages/adapters/gemini/src/runtime/shared.ts`](../../../packages/adapters/gemini/src/runtime/shared.ts) 生成 `.ai/.mock/.gemini/settings.json`，把 selected MCP 写入 `mcpServers`，把 managed hook groups 写进 `hooks`
- 如果模型选择是 `service,model`，则在 [`packages/adapters/gemini/src/runtime/proxy.ts`](../../../packages/adapters/gemini/src/runtime/proxy.ts) 启动本地兼容代理，把 Gemini `generateContent` 流量转成上游 `chat/completions`

设计考量：

- Gemini CLI 已经有稳定的 `settings.json` native hooks 落点，Vibe Forge 通过 generic `vf-call-hook` + [`packages/adapters/gemini/src/hook-bridge.ts`](../../../packages/adapters/gemini/src/hook-bridge.ts) 做事件映射
- 外部服务支持依赖共享层 `modelServices`，但 Gemini adapter 只接受 OpenAI-compatible `chat/completions`
- OpenCode overlay 之类没有稳定 Gemini 原生映射的资产继续标记为 `skipped`
