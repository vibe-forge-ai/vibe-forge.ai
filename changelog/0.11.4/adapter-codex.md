# @vibe-forge/adapter-codex 0.11.4

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/adapter-codex@0.11.4`

## 主要变更

- Codex adapter 初始化时同步到隔离 home 的 skill 源目录，现在会跟随项目配置的 AI 基目录解析。
- 项目把资产目录从 `.ai` 改到其他位置后，Codex 运行时可以继续正确发现并同步本地 skills。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增 adapter 配置项。
- 默认 `.ai` 目录结构下的行为保持不变。
