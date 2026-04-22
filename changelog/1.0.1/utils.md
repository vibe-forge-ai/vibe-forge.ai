# @vibe-forge/utils 1.0.1

发布日期：2026-04-17

## 发布范围

- 发布 `@vibe-forge/utils@1.0.1`

## 主要变更

- 新增统一的 symlink 同步 helper，供 adapter runtime 在同步 mock home 资产与配置时复用。
- helper 现在会复用已存在且目标正确的软链接，并在并发创建时将“另一个进程已经创建成功”的 `EEXIST` 视为可恢复场景，避免启动竞态直接失败。

## 兼容性说明

- 本次为向后兼容的 patch 发布，只新增运行时 helper，不移除现有导出。
