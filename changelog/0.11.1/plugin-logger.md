# @vibe-forge/plugin-logger 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/plugin-logger@0.11.1`

## 主要变更

- `logger` 插件记录 Bash `PostToolUse` 输出时，会对行首的 Markdown code fence 自动转义，避免 `stdout`、`stderr`、命令描述或命令文本里包含 `\`\`\`bash` 等内容时截断日志渲染。
- 共享 markdown logger 现在也会在 YAML folded 多行文本和 error text block 中做同样的 fence 转义，保持 plugin hook 日志与主会话日志的渲染行为一致。
- 补充了 `plugin-logger` 与共享 logger 的定向回归测试，覆盖日志正文中嵌套 code fence 的场景。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不改变插件导出面和 hook 事件契约。
- 现有日志结构保持不变，仅修正包含 Markdown fence 的文本在 `.log.md` 中的展示稳定性。
