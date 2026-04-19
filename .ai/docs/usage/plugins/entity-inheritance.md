# 实体继承

返回入口：[插件与数据资产](../plugins.md)

实体可以通过 `extends` 继承本地实体或插件实体：

```yaml
---
name: frontend-reviewer
description: 前端评审实体
extends:
  - std/dev-reviewer
inherit:
  prompt: append
  rules: merge
  skills: merge
  tools: replace
  mcpServers: replace
---

在标准评审要求上，额外关注交互、样式、focus、主题和移动端布局。
```

说明：

- `extends` 可以是单个实体标识，也可以是有序列表。
- 插件实体使用现有 `scope/name` 标识，例如 `std/dev-reviewer`。
- 多个父实体会先按 `extends` 顺序组合成一个 inherited base。
- `inherit` 只控制当前实体如何继承 inherited base，不控制父实体之间的组合。
- 默认会追加 prompt，并合并 `tags`、`rules`、`skills`。
- `tools` 和 `mcpServers` 默认使用子实体配置；子实体未配置时继承父实体组合结果。
- `plugins` 不会从父实体继承。
