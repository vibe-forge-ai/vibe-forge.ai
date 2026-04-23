# @vibe-forge/adapter-copilot 3.0.0-alpha.8

发布日期：2026-04-24

## 发布范围

- 发布 `@vibe-forge/adapter-copilot@3.0.0-alpha.8`

## 主要变更

- 依赖 `@vibe-forge/utils@3.0.0-alpha.8`，使 Copilot CLI 默认优先使用项目 managed 安装版本。

## 兼容性说明

- 仍可通过 `adapters.copilot.cli.source = "system"` 或环境变量显式选择用户 PATH 上的 Copilot CLI。
