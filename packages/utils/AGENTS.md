# Utils Package

`@vibe-forge/utils` 承载跨 runtime 共用的基础 helper。
当前收口的是 markdown logger、log level 解析、字符串 key 转换、文档路径/命名 helper、uuid、chat-message helper、cache、model selection 和系统通知工具。

## 先看哪里

- `src/create-logger.ts`
  - 主会话 / hook runtime 共用的 markdown logger
- `src/log-level.ts`
  - `normalizeLogLevel()` / `resolveServerLogLevel()`
- `src/string-transform.ts`
  - 对象 key 转换 helper
- `src/document-path.ts`
  - definition / workspace 共享的路径规范化与命名规则
- `src/model-selection.ts`
  - model service、defaultModel、adapter/model 兼容性处理
- `src/cache.ts`
  - `.ai/caches/<task>/<session>/<key>.json` 读写 helper
- `src/system.ts`
  - `notify()`
  - 桌面通知 options schema
  - 默认图标与默认音效资产解析
- `__tests__/create-logger.spec.ts`
- `__tests__/log-level.spec.ts`

## 当前边界

- 本包负责：
  - 通用 logger 实现
  - 通用 log level 解析
  - 通用对象 key transform
  - 通用文档路径与命名 helper
  - 通用 cache helper
  - 通用 model selection helper
  - 通用 system helper
- 本包不负责：
  - task 生命周期
  - 配置读取
  - adapter / hook / mcp 协议翻译

## 维护约定

- 只放可复用、无业务编排的 helper；带产品语义的逻辑留在消费包。
- 优先依赖 `@vibe-forge/types`，不要反向依赖 `core`、`hooks` 或 `mcp`。
- 修改 logger 或 log level 规则后，至少回归 `packages/utils/__tests__` 和相关消费方测试。
