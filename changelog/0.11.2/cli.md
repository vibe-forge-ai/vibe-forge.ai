# @vibe-forge/cli 0.11.2

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/cli@0.11.2`

## 主要变更

- `vf --print` 遇到权限或其他输入请求时，只会在 `--input-format stream-json` 下继续保持可交互；`text` / `json` 模式现在会明确打印请求后退出，避免会话看起来还活着但其实无法回复输入。
- `vf --resume ... --print` 的权限恢复缓存改成在“成功写入授权结果”前不删除。用户选择 `cancel`，或 project/session 权限落盘失败时，挂起的权限请求会被保留下来，后续还能继续恢复。

## 兼容性说明

- 本次为向后兼容的 patch 发布。
- 若你依赖 print 模式下的 live interaction 回复，请统一使用 `--input-format stream-json`。
