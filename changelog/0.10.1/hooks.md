# @vibe-forge/hooks 0.10.1

发布日期：2026-04-10

## 发布范围

- 发布 `@vibe-forge/hooks@0.10.1`

## 主要变更

- 内置权限镜像在读取 session/project 权限时会先做统一归一化，再匹配 allow/deny/onceAllow/onceDeny。
- 这次修复让带别名、大小写或 managed key 形式的权限项在 hooks 侧和主运行时保持一致，不再出现镜像文件里明明已授权但 hooks 仍重复询问的情况。

## 兼容性说明

- 不改 hooks API。
- 仅收敛权限镜像读取行为，已有权限文件格式继续兼容。
