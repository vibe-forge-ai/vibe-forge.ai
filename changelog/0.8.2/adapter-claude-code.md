# @vibe-forge/adapter-claude-code 0.8.2

发布日期：2026-03-31

## 发布范围

- 发布 `@vibe-forge/adapter-claude-code@0.8.2`

## 主要变更

- 修复 Claude 主会话启动时直接依赖系统 `PATH` 查找 `claude` binary 的问题
- `claude` 与 `ccr` 现在都会从 `@vibe-forge/adapter-claude-code` 的依赖包 `package.json/bin` 解析真实可执行路径
- 避免工作区里存在全局旧版 Claude CLI 或其他包内 binary 时，被错误命中并触发异常登录态

## 兼容性说明

- 对外 CLI 参数与行为保持不变
- 变更仅影响 adapter 内部 binary 解析策略，优先使用当前发布包依赖树中的 Claude Code / Claude Code Router 可执行文件
