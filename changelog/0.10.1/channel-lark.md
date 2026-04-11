# @vibe-forge/channel-lark 0.10.1

发布日期：2026-04-12

## 发布范围

- 发布 `@vibe-forge/channel-lark@0.10.1`

## 主要变更

- 正式发布包补齐 `./mcp` export，并与源码里的 `__vibe-forge__` conditional entry 保持一致。
- 消费侧现在可以稳定解析 `@vibe-forge/channel-lark/mcp`，不再因为发布产物缺少子路径导出而在启动阶段失败。
- 这次修复同时让 Lark channel 的 MCP 能力和 connection 入口按同一套导出规则对外暴露。

## 兼容性说明

- 不新增配置项。
- 现有 Lark channel 配置保持不变，这次只修正正式发布包的子路径导出。
