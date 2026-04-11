# @vibe-forge/register 0.10.2-alpha.0

发布日期：2026-04-12

## 发布范围

- 发布 `@vibe-forge/register@0.10.2-alpha.0`

## 主要变更

- `@vibe-forge/register/esbuild` 不再默认编译整个 `node_modules`
- 运行时 transpile 改为包级元数据显式 opt-in，支持 `vibeForge.runtimeTranspile: true`
- 继续兼容通过 `imports` / `exports` 中 `__vibe-forge__` 条件声明源码入口的包，避免已有源码包回退

## 兼容性说明

- 工作区源码仍默认走 runtime transpile
- 第三方 `node_modules` 只有显式声明后才会被编译，避免误伤原生 ESM 依赖
