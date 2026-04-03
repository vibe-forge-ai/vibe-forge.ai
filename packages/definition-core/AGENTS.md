# Definition Core 包说明

`@vibe-forge/definition-core` 承载 definition 领域共享语义 helper。

## 什么时候先看这里

- definition 的名称、标识、摘要推导不一致
- remote rule reference 在不同包里的投影不一致
- `definition-loader` 和 `workspace-assets` 之间需要共享 definition 领域 helper

## 入口

- `src/index.ts`
  - definition 名称、标识、摘要、always 语义 helper
  - remote rule reference 到 definition 的投影 helper
- `__tests__/definition-core.spec.ts`

## 当前边界

- 本包负责：
  - definition 名称解析
  - spec / entity / skill 标识解析
  - definition 摘要描述解析
  - rule always 语义兼容
  - remote rule reference 的 definition 投影
- 本包不负责：
  - 文档发现与读取
  - prompt 文本拼装
  - workspace asset 选择
  - task 生命周期编排

## 维护约定

- 只放 definition 领域共享语义，不放通用路径工具，也不放 prompt builder。
- 依赖保持轻量，优先只依赖 `@vibe-forge/types`。
