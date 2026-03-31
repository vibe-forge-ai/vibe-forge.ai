# Hooks 维护经验

返回入口：[HOOKS-REFERENCE.md](../HOOKS-REFERENCE.md)

## 已验证经验

- 真实 CLI 和单元测试解决的是两类问题；hooks 改动合并前，三家都至少要有一轮真实 CLI smoke。
- OpenCode 更适合以 JSON 事件流作为稳定执行基线。
- OpenCode 配置不能只靠 `OPENCODE_CONFIG_CONTENT`，更稳妥的方式是先准备 session config dir，再落真实 `opencode.json`。
- Claude Code 会叠加项目级和 mock home 两套 settings；排查重复 hook 时不能只看 `.ai/.mock/.claude/settings.json`。
- hooks/logger 不要直接落完整输入对象，尤其是 `env`、`apiKey`、`token`、`secret`、`authorization`。
- 文档只能写已经验证过的路径；不稳定的路径要明确写成“优先尝试”或“已知问题”。

## Clean 清单

- 统一复用已有 hook 输入 contract，不再为单 adapter 衍生一套私有字段。
- 日志解析、snapshot 投影和 assertions 共用一层 parser，不分散实现。
- runner 只负责执行和采集，期望判断留在 case / snapshot 层。
