# @vibe-forge/utils 3.0.0-alpha.8

发布日期：2026-04-24

## 发布范围

- 发布 `@vibe-forge/utils@3.0.0-alpha.8`

## 主要变更

- Managed npm CLI 默认优先使用项目缓存/项目自动安装的 CLI，再回退到用户 PATH 上的系统 CLI。

## 兼容性说明

- 显式配置 `cli.source = "system"` 或对应 `__VF_PROJECT_AI_ADAPTER_*_CLI_SOURCE__=system` 时仍会优先使用系统 CLI。
