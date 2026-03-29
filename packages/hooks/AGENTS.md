# Hooks Package

`@vibe-forge/hooks` 承载通用 hook runtime、native helper、bridge loader 与 `vf-call-hook` 二进制。
hook runtime 直接依赖 `@vibe-forge/config`、`@vibe-forge/utils` 与 `@vibe-forge/types`。

## 先看哪里

- `call-hook.js`
  - hook 子进程入口
  - 负责切到工作区 `.ai/.mock` HOME，并加载真实 entry
- `src/entry.ts`
  - 优先发现当前 active adapter 的 `./hook-bridge`
  - 未命中时回退默认 runtime
- `src/runtime.ts`
  - 统一读取 hook 输入、装载配置、执行 plugin 链
- `packages/config/src/load.ts`
  - 配置读取、变量替换与缓存
- `packages/utils/src/create-logger.ts`
  - markdown logger
- `packages/utils/src/log-level.ts`
  - log level 解析
- `packages/utils/src/string-transform.ts`
  - hook 输入 key 转换
- `src/native.ts`
  - mock home、托管脚本路径、native 配置读写 helper
- `src/bridge.ts`
  - framework bridge，把会话消息和工具事件转成统一 hook 协议

## 当前边界

- `packages/hooks`:
  - hook 输入输出类型
  - plugin middleware 执行
  - `vf-call-hook` 与 managed script path
  - adapter native hook bridge loader
- `packages/config`:
  - hook runtime 用到的配置加载与缓存
- `packages/utils`:
  - hook runtime 与 task runtime 共用的 logger / log-level / string helper
- `packages/types`:
  - hook 插件配置契约与共享基础类型
- `packages/task`:
  - task 生命周期里的 `TaskStart` / `TaskStop` / native-bridge 去重
- adapters:
  - 各家 native payload 翻译
  - 各家 mock-home / config-dir 托管配置写入

## 维护约定

- 通用 hook 协议、native helper、bridge loader 收口在本包，不要再回写到 `core` 或 `cli`。
- 运行时基础设施优先放进 `@vibe-forge/config` 或 `@vibe-forge/utils`，不要在本包里重复实现一份。
- 不要重新引入面向 `core` 的 runtime bindings 层；本包保持对 `core` 的静态解耦。
- 新增 native helper 时，先判断它属于“配置写入”还是“事件翻译”，不要把两类职责混到同一个入口。
- 修改 runtime 后优先回归：
  - `pnpm -C packages/hooks test`
  - `pnpm -C packages/config test`
  - `pnpm -C packages/utils test`
  - `pnpm -C apps/cli test`
  - 相关 adapter 的 `native-hooks.spec.ts` / `hook-bridge.spec.ts`
