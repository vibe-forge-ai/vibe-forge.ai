# @vibe-forge/benchmark 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/benchmark@0.11.1`

## 主要变更

- benchmark 的用例发现、结果落盘和 workspace 运行目录现在都会跟随 `__VF_PROJECT_AI_BASE_DIR__` 解析。
- 这次调整让 benchmark 运行时不再假定项目资产和缓存必须放在 `./.ai/` 下。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增 benchmark 配置字段。
- 未配置环境变量时，默认目录仍然是 `.ai`。
