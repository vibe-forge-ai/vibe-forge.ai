# @vibe-forge/hooks 0.10.2

发布日期：2026-04-10

## 发布范围

- 发布 `@vibe-forge/hooks@0.10.2`

## 主要变更

- hooks 运行时在加载注册器和 hook 实现前，会优先按项目包目录补齐 `NODE_PATH` 模块搜索路径。
- 这次修复让 managed runtime 下的 hook 进程与主 CLI 共享一致的依赖解析结果，避免项目已安装插件在 hook 链路里丢失。

## 兼容性说明

- 不改 hooks API。
- 仅调整 hook 子进程的模块解析方式，现有 hook 实现无需修改。
