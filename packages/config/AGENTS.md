# Config Package

`@vibe-forge/config` 承载通用配置读写、`defineConfig()`、默认 system prompt 策略与默认内建 MCP 解析。
业务 schema 类型仍由 `@vibe-forge/types` 维护。

## 先看哪里

- `src/load.ts`
  - `buildConfigJsonVariables()`
  - `loadConfig()`
  - `loadAdapterConfig()`
  - `resetConfigCache()`
- `src/update.ts`
  - `updateConfigFile()`
- `src/define.ts`
  - `defineConfig()`
- `src/system-prompt.ts`
  - 默认 system prompt 开关解析与提示词合并
- `src/default-vibe-forge-mcp.ts`
  - 默认内建 MCP 开关与 package 解析
- `__tests__/load.spec.ts`
  - 配置缓存与 dev config 行为回归

## 当前边界

- 本包负责：
  - 配置文件查找顺序
  - project/user config 文件写回
  - `${ENV_VAR}` 变量替换
  - workspace 级缓存与 cache reset
  - `defineConfig()` typed helper
  - 默认 system prompt 开关解析与合并策略
  - 默认内建 MCP 开关与 package 解析
- 本包不负责：
  - `Config` 业务 schema 定义本身
  - project/user config merge 策略
  - adapter / hook / server 的消费语义

## 维护约定

- 保持 loader 泛型化；不要为了某个消费方把 `core`、`hooks` 或 `server` 的 schema 直接引进来。
- `defineConfig()` / system prompt helper 只消费共享 `Config` 类型，不在这里重新定义 schema。
- merge 逻辑放在消费方，不要在这里偷偷塞业务规则；`updateConfigFile()` 只处理配置文件持久化和受控字段更新。
- 新增环境变量替换、默认 system prompt 规则或缓存规则时，先补 `__tests__/*`。
