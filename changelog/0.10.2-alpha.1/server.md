# @vibe-forge/server 0.10.2-alpha.1

发布日期：2026-04-12

## 发布范围

- 发布 `@vibe-forge/server@0.10.2-alpha.1`

## 主要变更

- 使用 workspace 发布流程重新发布 `@vibe-forge/server`
- 修正 alpha 包内依赖版本展开，确保消费者安装时不会残留 `workspace:^`
- 保持对 `@vibe-forge/register@0.10.2-alpha.0` 的 runtime 修复透传

## 兼容性说明

- 不改 server 启动方式与源码入口
- 这次 alpha 仅修正发布产物中的依赖元数据
