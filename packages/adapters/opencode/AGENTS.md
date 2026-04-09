# OpenCode Adapter

## 文档入口

- `.ai/rules/ADAPTERS.md`
  - adapter 统一设计、原生资产自动适配、运行时配置和真实 CLI 验证入口
- `.ai/rules/HOOKS.md`
  - 通用 hooks 方案、事件矩阵、`.ai/.mock` 托管配置布局
- `.ai/rules/HOOKS-REFERENCE.md`
  - 真实 CLI 验证命令、维护经验、共用实现入口
- `apps/cli/src/AGENTS.md`
  - CLI hook bridge 与 `call-hook.js` 入口

## 目录职责

- `src/runtime/common/`
  - 纯配置与参数映射层，只做 prompt、tools、permissions、model、mcp、session record 转换
  - 不承载进程控制
- `src/runtime/session/`
  - 运行时层，负责 child env、skill bridge、direct/stream 会话执行与错误传播
- `src/runtime/native-hooks.ts`
  - 把 `.ai/.mock/.config/opencode/` 写成托管 config/plugin
  - 把真实用户配置镜像到 mock config dir
- `src/runtime/common.ts` / `src/runtime/session.ts`
  - 稳定入口文件，只做 re-export 或轻量路由
- `__tests__/runtime-*.spec.ts`
  - 按能力拆分测试；公共 mock 和文件系统 helper 放在 `__tests__/runtime-test-helpers.ts`

## Hooks 维护入口

- `src/runtime/native-hooks.ts`
  - 负责 `.ai/.mock/.config/opencode/plugins/vibe-forge-hooks.js`
- `src/runtime/session/skill-config.ts`
  - base config、plugins、skills 镜像到 session config dir
- `src/runtime/session/child-env.ts`
  - session 级 `opencode.json`、provider config、child env
- `src/runtime/session/stream.ts`
  - `opencode run --format json` 事件流消费与最终文本提取
- `src/runtime/common/tools.ts`
  - `opencode run` 参数构造
- `packages/hooks/call-hook.js`
  - OpenCode 托管 plugin 最终回调到这里，再进入共享 hook runtime
- `packages/hooks/src/native.ts`
- `packages/hooks/src/bridge.ts`
- `packages/task/src/run.ts`

维护时保持这条边界：

- OpenCode adapter 负责 plugin/config dir/session env
- CLI 或 upstream 事件流负责把 tool 事件送出来
- hooks runtime 负责统一插件执行，task runtime 负责去重
- OpenCode 的 skills 继续保持 session 级 `OPENCODE_CONFIG_DIR` 投影；不要把 `.ai/skills` 在 init 阶段全量挂进 mock home，否则会绕过 include/exclude skill 选择和 overlay 规划

OpenCode 官方文档：

- [OpenCode Agent Skills](https://opencode.ai/docs/skills)
- [OpenCode Config](https://opencode.ai/docs/config/)

## 真实 CLI 验证

优先尝试包装层：

仓库根快捷命令：

```bash
pnpm test:e2e:adapters
pnpm tools adapter-e2e run opencode
pnpm tools adapter-e2e test opencode-read-once --update
```

这条命令会先试 `vf --adapter opencode`，超时后自动 fallback 到 upstream `opencode run --format json`。
它默认也会启动本地 mock LLM server，并通过仓库根 `.ai.config.json` 里的 `hook-smoke-mock` model service 驱动 OpenCode。adapter E2E 的共享 harness 在 `scripts/adapter-e2e/`，scripts CLI 入口在 `scripts/cli.ts`。
case 定义、spec 和期望快照统一维护在 `scripts/__tests__/adapter-e2e/`。

```bash
__VF_PROJECT_AI_CTX_ID__='hooks-smoke-opencode' \
node apps/cli/cli.js \
  --adapter opencode \
  --model hook-smoke-mock,opencode-hooks \
  --print \
  --no-inject-default-system-prompt \
  --exclude-mcp-server ChromeDevtools \
  --session-id '<uuid>' \
  "Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else."
```

如果包装层没有自然结束，直接复用 session config dir 调 upstream：

```bash
HOME="$PWD/.ai/.mock" \
OPENCODE_CONFIG_DIR="$PWD/.ai/.mock/.opencode-adapter/<sessionId>/config-dir" \
__VF_VIBE_FORGE_OPENCODE_HOOKS_ACTIVE__='1' \
__VF_PROJECT_WORKSPACE_FOLDER__="$PWD" \
__VF_PROJECT_NODE_PATH__="$(which node)" \
__VF_PROJECT_REAL_HOME__="$HOME" \
__VF_PROJECT_CLI_PACKAGE_DIR__="$PWD/apps/cli" \
__VF_PROJECT_PACKAGE_DIR__="$PWD/apps/cli" \
__VF_OPENCODE_TASK_SESSION_ID__='<sessionId>' \
__VF_OPENCODE_HOOK_RUNTIME__='cli' \
packages/adapters/opencode/node_modules/.bin/opencode run \
  --print-logs \
  --format json \
  --model opencode/gpt-5-nano \
  --dir "$PWD" \
  "Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else."
```

通过标准：

- 终端输出 `E2E_OPENCODE`
- `.ai/logs/<ctxId>/<sessionId>.log.md` 出现 `SessionStart` / `PreToolUse` / `PostToolUse` / `Stop`
- `.ai/.mock/.config/opencode/opencode.json` 与 `plugins/vibe-forge-hooks.js` 仍落在 mock config dir

OpenCode 维护时优先记住：

- 优先把 `opencode run --format json` 当成稳定基线，不要再依赖最终 stdout 文本猜事件
- session config 不要只靠 `OPENCODE_CONFIG_CONTENT`，优先写真实 `opencode.json`
- 包装层与 upstream 直跑当前仍可能有行为差异，文档里必须写清楚

## 约束

- 单文件保持在 200 行以内；接近 160 行时优先继续拆，而不是继续堆分支
- 新增逻辑先判断属于“映射层”还是“运行时层”，不要再把两类职责混回一个文件
- 需要 mock `child_process` 的测试，mock 定义放在各自 spec 顶部；helper 不直接持有全局 mock 状态
- 修改 adapter 行为时，至少补一条对应的 runtime 或 common 回归测试
- OpenCode 的 native hooks 通过 `.ai/.mock/.config/opencode/plugins/vibe-forge-hooks.js` 接入；stdout 文本桥接只负责会话输出，不承担 native hooks
