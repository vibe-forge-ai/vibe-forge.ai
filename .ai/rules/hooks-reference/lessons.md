# Hooks 维护经验

返回入口：[HOOKS-REFERENCE.md](../HOOKS-REFERENCE.md)

## 已验证经验

- 真实 CLI 和单元测试解决的是两类问题；hooks 改动合并前，每个有 native hooks 的 adapter 都至少要有一轮真实 CLI smoke。
- OpenCode 更适合以 JSON 事件流作为稳定执行基线。
- OpenCode 配置不能只靠 `OPENCODE_CONFIG_CONTENT`，更稳妥的方式是先准备 session config dir，再落真实 `opencode.json`。
- Claude Code 会叠加项目级和 mock home 两套 settings；排查重复 hook 时不能只看 `.ai/.mock/.claude/settings.json`。
- Codex transcript JSONL 适合做非 Bash 工具的统计补链路，但它是事后观测，不具备 native hook 返回值语义；不要把它设计成 `PreToolUse` / `PostToolUse` 的等价替身。
- Codex transcript JSONL 的集成验证可以通过“先跑真实 codex wrapper，再向当前 session transcript 注入受控 response_item”来做，这样能验证 watcher、logger 和 snapshot 投影的整条链路，又不需要伪造 native Bash hooks。
- Codex transcript 注入型 e2e 要先清空 `.ai/.mock/.codex/sessions/`，再去找当前 run 生成的 transcript；否则 suite 内多 case 连跑时很容易命中旧文件。
- hooks/logger 不要直接落完整输入对象，尤其是 `env`、`apiKey`、`token`、`secret`、`authorization`。
- 文档只能写已经验证过的路径；不稳定的路径要明确写成“优先尝试”或“已知问题”。

## Clean 清单

- 统一复用已有 hook 输入 contract，不再为单 adapter 衍生一套私有字段。
- 日志解析、snapshot 投影和 assertions 共用一层 parser，不分散实现。
- runner 只负责执行和采集，期望判断留在 case / snapshot 层。
