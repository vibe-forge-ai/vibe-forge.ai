# Home Skill Auto-Bridge

返回入口：[../skills.md](../skills.md)

从当前版本开始，Vibe Forge 默认也会桥接用户真实 home 里的常见 skill 目录，并把它们像项目 skill 一样加入统一 workspace assets：

- `~/.agents/skills`
- `~/.claude/skills`
- `~/.config/opencode/skills`
- `~/.gemini/skills`

这里的 `~` 优先基于 `__VF_PROJECT_REAL_HOME__` 展开；没有这个环境变量时，再退回进程的真实 `HOME`。不存在的目录会直接跳过，不会报错。

桥接后的 home skills 会：

- 出现在 `/api/ai/skills` 和 Knowledge Base
- 参与默认 skill 选择，不只是“原生目录可见”
- 继续走统一的依赖解析、 prompt selection 和 adapter 投影链路

默认情况下，这些 skill 会被投影到 workspace 本地的 mock / session 目录，而不是直接复制回真实 home。仓库默认把 `./.ai/.mock`、`./.ai/.local`、`./.ai/caches` 加进 `.gitignore`；如果你把 AI 基目录改到别的位置，请确保对应的 mock / cache 目录也继续被 Git 忽略。

这些投影默认是目录直链（symlink），不是物理拷贝。如果底层 CLI 或 adapter 在运行时直接编辑 `SKILL.md`、新增文件，改动会写回用户真实 home 下的 skill 目录。

如果同名 skill 同时存在于多个来源，优先级是：

1. 项目 skill
2. 已启用插件 skill
3. 运行时下载的 registry dependency
4. home-bridge skill

多个 home roots 出现同名 skill 时，按 roots 配置顺序保留第一份，后面的同名项会被跳过。

关闭或覆盖默认 home roots：

```yaml
skills:
  homeBridge:
    enabled: false
```

```yaml
skills:
  homeBridge:
    roots:
      - ~/.agents/skills
      - /opt/team-skills
```

`roots` 只支持绝对路径或以 `~` 开头的路径。
