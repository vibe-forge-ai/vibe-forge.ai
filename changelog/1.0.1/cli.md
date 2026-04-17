# @vibe-forge/cli 1.0.1

发布日期：2026-04-17

## 发布范围

- 发布 `@vibe-forge/cli@1.0.1`

## 主要变更

- `vf run` 现在会把 `__VF_PROJECT_WORKSPACE_FOLDER__` 解析后的目录作为真正的运行工作目录，而不是继续固定使用启动目录。
- `vf list`、`vf stop`、`vf kill` 会与 `vf run` 共享同一套 workspace cwd 解析，session cache 不会再落到启动目录和工作目录两个位置。
- CLI 会把解析后的 `__VF_PROJECT_WORKSPACE_FOLDER__` 归一成绝对路径，避免相对路径在后续命令链路中被二次展开。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增命令参数。
- 未配置 `__VF_PROJECT_WORKSPACE_FOLDER__` 的项目会继续保持现有默认行为。
