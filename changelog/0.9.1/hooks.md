# @vibe-forge/hooks 0.9.1

发布日期：2026-04-05

## 发布范围

- 发布 `@vibe-forge/hooks@0.9.1`

## 主要变更

- `callHook()` 现在会把当前请求的 hook event 名传给 native bridge 选择层。
- 当运行环境里存在 native hook bridge，但该 bridge 不支持当前 event 时，hooks runtime 会自动回退到 managed hooks，而不是直接短路。
- 这次修复解决了 framework-only hook event 在混合运行环境里被错误吞掉的问题，例如任务系统内部事件无法继续流入 managed plugin 链。

## 兼容性说明

- 已支持当前 event 的 native bridge 行为不变。
- 如果某个 native bridge 没有声明自己支持哪些 event，当前版本仍会保持向后兼容的选择行为。
