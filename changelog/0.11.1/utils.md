# @vibe-forge/utils 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/utils@0.11.1`

## 主要变更

- 权限工具名归一化新增对 `adapter:<adapter>:<tool>` 形式的处理，像 `adapter:claude-code:Write` 这类原生工具名会先还原成真实工具，再参与 session/project 权限匹配。
- markdown logger 会转义多行日志和错误堆栈里的 fenced code block 起始行，避免日志正文自带的 ``` 破坏外围日志格式。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不新增导出入口。
- 已有权限 key 和日志调用方式继续可用，调整主要用于收敛边界场景。
