# Adapter 真实 CLI 验证

返回入口：[ADAPTERS.md](../ADAPTERS.md)

## 原则

- 不要只跑单测；至少跑一次真实 `npx vf run`
- 尽量让验证命令只测一件事
- 当你在验证原生 skills 时，优先加 `--no-inject-default-system-prompt`，避免把“prompt 注入命中”误判成“native skills 命中”

hooks 事件链路的专项验证继续看 [HOOKS-REFERENCE.md](../HOOKS-REFERENCE.md)。

## 启动基线

### Claude Code

```bash
npx vf run --adapter claude --print 你好
```

### Codex

```bash
npx vf run --adapter codex --print 你好
```

### OpenCode

```bash
npx vf run --adapter opencode --print 你好
```

## Native skills smoke

### Claude Code

1. 在 `.ai/skills/<probe>/SKILL.md` 放一个只会命中特定触发词的 probe skill
2. 运行：

```bash
npx vf run --adapter claude --print --no-inject-default-system-prompt 'vf claude native skill probe'
```

预期：

- 输出命中 probe skill 的固定文本
- 说明 `.ai/skills -> .ai/.mock/.claude/skills` 这条链路生效

### Codex

1. 在 `.ai/skills/<probe>/SKILL.md` 放一个只会命中特定触发词的 probe skill
2. 运行：

```bash
npx vf run --adapter codex --print --no-inject-default-system-prompt 'vf codex native skill probe'
```

预期：

- 输出命中 probe skill 的固定文本
- 说明 `.ai/skills -> .ai/.mock/.agents/skills` 这条链路生效

### OpenCode

OpenCode 的技能验证不要照搬上面两条。它的 skills 是 session 级 `OPENCODE_CONFIG_DIR` 投影，验证时还要覆盖：

- `--include-skill`
- `--exclude-skill`
- overlay skill

优先复用已有的 [`packages/adapters/opencode/__tests__/session-runtime-config.spec.ts`](../../../packages/adapters/opencode/__tests__/session-runtime-config.spec.ts) 和 adapter E2E。

## Worktree fallback smoke

当你怀疑 worktree 没拿到主工作树的 dev config 时，直接用真实 CLI 验证：

1. 临时移走当前 worktree 的 `.ai.dev.config.json`
2. 执行：

```bash
npx vf run --adapter claude --print 'hello from fallback test'
```

如果当前工作区和主工作树都配置正确，这条命令应仍能正常启动，不需要在当前 worktree 再复制一份 dev config。

## 关注点

- 如果命令秒退，优先看配置加载、adapter 选择和 native binary 解析
- 如果命令能启动但没有命中 skill，优先排查原生目录是否真的被同步
- 如果技能链路正常但 hooks 没触发，回到 [HOOKS-REFERENCE.md](../HOOKS-REFERENCE.md)
