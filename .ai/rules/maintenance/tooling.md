# 消息级操作维护工具

本文收口这次开发里反复使用、后续也建议复用的工具链与调用方式。

## 统一入口

新增了一个 repo 内固定命令：

```bash
pnpm tools message-actions verify
```

用途：

- 跑 `eslint`
- 跑 `dprint check`
- 跑 `pnpm typecheck`
- 跑消息级操作相关的 server/db/websocket 回归测试
- 最后打印真实 Chrome 手工回归清单

如果只想看步骤结果，不想流式打印子进程输出：

```bash
pnpm tools message-actions verify --quiet
```

## 质量检查命令

### 全量质量检查

```bash
pnpm exec eslint .
pnpm exec dprint check
pnpm typecheck
```

适用场景：

- 准备提交前
- PR review 修复后
- CI 失败需要本地复现时

### 目标回归测试

```bash
pnpm exec vitest run --workspace vitest.workspace.ts \
  apps/server/__tests__/db/index.spec.ts \
  apps/server/__tests__/db/schema.spec.ts \
  apps/server/__tests__/services/session-history.spec.ts \
  apps/server/__tests__/services/session-interaction.spec.ts \
  apps/server/__tests__/services/session-start.spec.ts \
  apps/server/__tests__/services/session.spec.ts \
  apps/server/__tests__/websocket/server.spec.ts
```

适用场景：

- 修改消息分叉、历史裁切、runtime 启动类型、session runtime state 时

## PR / CI 工具

### 查看 PR 检查状态

```bash
gh pr checks <pr-number>
gh pr view <pr-number> --json mergeStateStatus,mergeable,statusCheckRollup
```

### 读取失败 job 日志

```bash
gh run view <run-id> --job <job-id> --log
```

用途：

- 区分是代码问题，还是 workflow 配置问题
- 尤其适合排查 `typecheck`、`format-check`、`commit-message`

### 持续等待检查完成

```bash
gh run watch <run-id> --exit-status
```

### 本地复现 commit range 校验

```bash
pnpm tools commitmsg-check <base> <head>
```

或者：

```bash
node scripts/check-commit-messages.mjs <base> <head>
```

## 真实 Chrome 回归

自动化检查不能替代真实界面验证。消息级操作改动完成后，至少手工确认下面几项：

1. 编辑进入后，原消息内容被编辑器替换，不会“原消息 + 编辑框”并存。
2. 编辑确认按钮文案为 `发送`。
3. 同时只能有一条消息编辑；再次点编辑会出现提示。
4. 编辑期间底部 sender 隐藏。
5. assistant 消息没有 fork，`复制原文` 能复制原始 markdown/text。
6. `edit / recall / fork` 进入新分支后，会触发新的 assistant 回复，而不是停在静态分支页。

## 使用建议

- 开始提 PR 前先跑一次 `pnpm tools message-actions verify`。
- 如果 PR 上某个质量检查失败，先用 `gh run view --job --log` 看真实错误，再决定是修代码还是修 workflow。
- 只有在本地质量检查和真实 Chrome 回归都通过后，再执行合并。
