# @vibe-forge/adapter-kimi 3.0.0-alpha.8

发布日期：2026-04-24

## 发布范围

- 发布 `@vibe-forge/adapter-kimi@3.0.0-alpha.8`

## 主要变更

- Kimi CLI 默认优先使用项目 managed 安装版本，再回退到用户 PATH 上的系统 CLI。

## 兼容性说明

- 仍可通过 `adapters.kimi.cli.source = "system"` 或环境变量显式选择用户 PATH 上的 Kimi CLI。
