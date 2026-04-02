# Definition Loader 包说明

`@vibe-forge/definition-loader` 承载 rules / skills / specs / entities 的文档发现、读取与 prompt 片段生成。

## 什么时候先看这里

- server 的 `/ai/specs`、`/ai/entities`、`/ai/rules` 返回不对
- workspace 下的 skills / specs / entities 没有被正确发现
- prompt route 片段生成异常
- 想确认定义文档的共享加载边界

## 入口

- `src/index.ts`
  - `DefinitionLoader`
- `src/definition-utils.ts`
  - `loadLocalDocuments()`
  - 定义文档解析、名称/引用解析
- `src/prompt-builders.ts`
  - rules / skills / specs / entities prompt 片段生成
- `__tests__/definition-loader.spec.ts`

## 当前边界

- 本包负责：
  - rules / skills / specs / entities 的文件发现与解析
  - markdown front-matter / entity json 读取
  - route / prompt 片段生成
- 本包不负责：
  - workspace asset bundle 组装
  - task 生命周期编排
  - config 读取与默认 MCP 注入

## 维护约定

- 只维护定义文档层面的加载与 prompt 生成，不要把 workspace asset 投影、cache 或 task runtime 逻辑塞进来。
- 文档路径规范化与命名规则复用 `@vibe-forge/utils/document-path`，不要在包内再复制一份。
- 优先依赖 `@vibe-forge/types` / `@vibe-forge/utils`，不要反向依赖 `task`、`hooks` 或 `mcp`。
- 新增定义文件形态或 prompt 规则时，先补 `__tests__/definition-loader.spec.ts`。
