# @vibe-forge/adapter-codex 0.10.1

发布日期：2026-04-10

## 发布范围

- 发布 `@vibe-forge/adapter-codex@0.10.1`

## 主要变更

- adapter 初始化时会把工作区 `.ai/skills` 映射到 mock home 的 `.agents/skills`，让 Codex 在隔离 HOME 下也能读取项目 skills。
- auth 文件链接逻辑改成优先读取运行时注入的真实 home，并在未提供真实 home 时安全跳过，不再强依赖单一环境变量来源。

## 兼容性说明

- 不新增用户配置项。
- 只影响 mock home 初始化链路，不改变已有会话协议和消息结构。
