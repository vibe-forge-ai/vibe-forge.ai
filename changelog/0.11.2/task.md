# @vibe-forge/task 0.11.2

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/task@0.11.2`

## 主要变更

- task runtime 现在支持在查询与执行阶段接收额外的 `plugins` 配置，并把这些插件一起纳入 workspace asset bundle 解析，使 npm 分发的 skills 能直接参与 prompt 组装。
- 当上层已经解析好 `assetBundle` 时，`prepare()` 会优先复用该结果，避免重复解析 workspace 资产并减少插件 skill 的二次加载分歧。
- `vf mcp run tasks` 在未显式指定权限模式时，会继承父会话的权限设置，而不是回落到更低默认值，减少子任务因权限不足而卡住的情况。

## 兼容性说明

- 本次为向后兼容的 patch 发布，原有 task 调用参数继续可用。
- 新增的 `plugins` 输入为增量能力；未传入时仍沿用现有 workspace 资产解析流程。
