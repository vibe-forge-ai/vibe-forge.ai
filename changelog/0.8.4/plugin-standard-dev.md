# @vibe-forge/plugin-standard-dev 0.8.4

发布日期：2026-04-03

## 发布范围

- 发布 `@vibe-forge/plugin-standard-dev@0.8.4`

## 主要变更

- 首次将标准开发工作流插件同步到 `0.8.4` 版本线，和当前主发布批次保持一致。
- 包内补齐标准开发流程的 plugin 资产，包括 `standard-dev-flow` spec、skill，以及 `dev-planner`、`dev-implementer`、`dev-reviewer`、`dev-verifier` 四类实体说明。
- 通过 `.npmignore` 明确保留这批 workflow 资产，确保安装后可以直接被工作区发现和消费。

## 兼容性说明

- 本次是版本线同步和首发补齐，不引入额外运行时依赖。
- 包级导出仍只暴露 `./package.json`；插件资产通过包内约定目录提供给 Vibe Forge 的 plugin / workspace asset 解析链路消费。
