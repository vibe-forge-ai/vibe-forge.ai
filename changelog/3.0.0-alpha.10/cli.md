# @vibe-forge/cli 3.0.0-alpha.10

发布日期：2026-04-24

## 发布范围

- 发布 `@vibe-forge/cli@3.0.0-alpha.10`

## 主要变更

- 撤销 `3.0.0-alpha.9` 中 CLI 直接依赖一方 adapter 的处理，恢复 adapter 由项目或调用方依赖提供。
- 更新运行时依赖链，使用新的 adapter package resolver。
