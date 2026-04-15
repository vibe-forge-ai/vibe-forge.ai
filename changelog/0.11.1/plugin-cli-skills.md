# @vibe-forge/plugin-cli-skills 0.11.1

发布日期：2026-04-15

## 发布范围

- 首次发布 `@vibe-forge/plugin-cli-skills@0.11.1`

## 主要变更

- 新增 `vf-cli-quickstart` skill，介绍 `vf run`、`vf list`、`vf --resume`、`vf stop`、`vf kill` 等常用 CLI 操作。
- 新增 `vf-cli-print-mode` skill，介绍 `--print`、`--input-format`、权限请求展示、恢复会话与 `submit_input` 的使用方式。
- 该包可作为独立 npm 插件分发，既可被 `@vibe-forge/cli` 默认注入，也可在其他 Vibe Forge runtime 配置中通过 `plugins: [{ id: '@vibe-forge/plugin-cli-skills' }]` 显式启用。

## 兼容性说明

- 这是新增公共包，不影响已有插件或 skill 的加载方式。
- 使用方只需保证运行环境能解析 npm 包内的 `skills/*/SKILL.md` 资产目录。
