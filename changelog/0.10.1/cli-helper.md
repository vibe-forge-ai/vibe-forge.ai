# @vibe-forge/cli-helper 0.10.1

发布日期：2026-04-10

## 发布范围

- 发布 `@vibe-forge/cli-helper@0.10.1`

## 主要变更

- managed runtime 启动时会基于项目包目录补齐 `NODE_PATH` 模块搜索路径，并与现有路径做去重合并。
- 这次修复让项目内已安装的插件包可以沿当前工作区依赖链被正确解析，不再误报 `Failed to resolve plugin package logger. Install it in the current workspace first.`

## 兼容性说明

- 不改 CLI helper 对外接口。
- 仅调整运行时模块解析链路，现有项目结构和插件声明方式继续兼容。
