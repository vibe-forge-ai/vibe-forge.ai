# @vibe-forge/cli 0.8.1

发布日期：2026-03-30

## 发布范围

- 发布 `@vibe-forge/cli@0.8.1`

## 主要变更

- 修复 `vf clear` 未清理 `.ai/.mock/.claude-code-router` 日志目录的问题
- 新增对 Claude Code Router 根日志文件与按日期生成的运行日志目录的清理
- 保留 `.claude-code-router` 下的 `config.json`、`plugins/` 与 pid 文件，避免清日志时误删运行配置

## 兼容性说明

- 无命令参数变更
- 仅调整日志清理范围，不影响 CLI 其它命令行为
