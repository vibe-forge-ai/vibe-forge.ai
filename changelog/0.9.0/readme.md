# 0.9.0

发布日期：2026-04-03

## 发布范围

- 统一发布全部 public workspace 包到 `0.9.0`
- 覆盖 CLI、Server、Client、MCP、Task、Hooks、Config、Utils、Types、Lark channel、内置 adapter、plugins 以及 support 包

## 主要变更

- 打通 `AskUserQuestion` 与权限确认在 Web、CLI print 模式和 Lark channel 下的完整交互闭环，补齐结构化输入、稳定选项值、权限上下文和恢复逻辑。
- 改进 Claude Code 权限恢复链路，统一归一化 `permission_required`，在权限模式切换后正确重启会话，并清理 CCR/OpenAI polyfill 恢复时的历史 `thinking` 元数据问题。
- 完善 Lark channel 的过程式交互体验，区分权限确认与自由问答的回复语义，补齐权限引导、无效回复重试提示、快捷回复降级和跨端状态同步。
- 调整 Web Chat sender 的权限态展示：权限请求时隐藏普通输入区，仅展示权限卡片；卡片选项完整展开，说明文案层级更清晰，并补齐中英文文案。
- 同步更新 Chrome/Lark 调试与回归能力，补充交互恢复、跨端清理、CLI 结构化输入和前端 sender 显隐的测试覆盖。

## 兼容性说明

- 本次为协调式整体版本升级，所有 public workspace 包统一提升到 `0.9.0`，便于消费方按单一版本线升级。
- `AskUserQuestion` 新增 `kind: permission`、`permissionContext` 和 `option.value` 语义；旧调用方式仍可继续使用，但若要获得更好的权限交互体验，建议按新字段补齐。
- CLI print 模式新增结构化 `input-format` 输入路径；保留既有文本输入行为。
